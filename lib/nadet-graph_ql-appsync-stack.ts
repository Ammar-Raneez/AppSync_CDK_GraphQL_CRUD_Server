import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnApiKey,
  CfnDataSource,
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnResolver,

} from 'aws-cdk-lib/aws-appsync';
import { AccountRecovery, CfnUserPoolGroup, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

export class NadetGraphQlAppSyncStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // cognito user pool & app client
    const userPool = new UserPool(this, 'AppSyncNotesUP', {
      userPoolName: 'AppSyncNotesUP',
      selfSignUpEnabled: true,
      accountRecovery: AccountRecovery.PHONE_AND_EMAIL,
      standardAttributes: {
        email: {
          required: true
        }
      }
    });

    const userPoolClient = new UserPoolClient(this, 'AppSyncUPClient', {
      userPool,
      userPoolClientName: 'AppSyncUPClient',
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    new CfnUserPoolGroup(this, 'AppSyncUPAdminsGroup', {
      groupName: 'AppSyncUPAdminsGroup',
      userPoolId: userPool.userPoolId
    });


    // Api data table
    const notesTable = new Table(this, 'AppSyncNotesTable', {
      tableName: 'AppSyncNotesTable',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      }
    });
    notesTable.addGlobalSecondaryIndex({
      indexName: 'notesByCompletion',
      partitionKey: {
        name: 'complete',
        type: AttributeType.STRING
      }
    });


    // Api itself
    const api = new CfnGraphQLApi(this, 'GraphQLAPI', {
      name: 'GraphQLAPI',
      authenticationType: 'API_KEY',
      xrayEnabled: true,
      logConfig: {
        fieldLogLevel: 'ALL'
      },
      additionalAuthenticationProviders: [{
        authenticationType: 'AMAZON_COGNITO_USER_POOLS',
        userPoolConfig: {
          userPoolId: userPool.userPoolId,
          appIdClientRegex: userPoolClient.userPoolClientId
        }
      }]
    });

    // use both api-key as well as cogito
    const apiKey = new CfnApiKey(this, 'GraphQLAPIkey', {
      apiId: api.attrApiId,
    });

    // api data schema
    const schema = new CfnGraphQLSchema(this, 'GraphQLSchema', {
      apiId: api.attrApiId,
      definition: `
        type Note @aws_api_key @aws_cognito_user_pool {
          id: ID!
          name: String!,
          complete: Boolean!
        }

        input NoteInput {
          name: String!
          complete: Boolean!
        }

        input UpdateNoteInput {
          id: ID!
          name: String
          complete: Boolean
        }

        type Query {
          getNoteById(noteId: ID!): Note
            @aws_api_key @aws_cognito_user_pool
          listNotes: [Note]
            @aws_api_key @aws_cognito_user_pool
          notesByCompletion(complete: Boolean!): [Note]
            @aws_api_key @aws_cognito_user_pool
        }

        type Mutation {
          createNote(note: NoteInput!): Note
            @aws_cognito_user_pool(cognito_groups: ["Admin"])
          deleteNote(noteId: ID!): ID
            @aws_cognito_user_pool(cognito_groups: ["Admin"])
          updateNote(note: UpdateNoteInput!): Note
            @aws_cognito_user_pool(cognito_groups: ["Admin"])
        }

        type Subscription {
          onCreateNote: Note
          @aws_subscribe(mutations: ["createNote"])
        }
      `
    });


    // provide required permissions
    const appsyncDynamoRole = new Role(this, 'NoteDynamoDBRole', {
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
    });

    appsyncDynamoRole.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['dynamodb:*', 'lambda:*', 'logs:*', 'cognito-idp:*'],
        effect: Effect.ALLOW,
      })
    );

    // create api lambdas
    const notesLambda = new NodejsFunction(this, 'NotesAPIhandler', {
      functionName: 'NotesAPIhandler',
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler',
      entry: join(__dirname, '..', 'lambdas', 'main.ts'),
      environment: {
        NOTES_TABLE: notesTable.tableName
      }
    });

    // connect dynamodb datasource to the api
    const dataSource = new CfnDataSource(this, 'NoteHandlerDataSource', {
      name: 'NoteHandlerDataSource',
      apiId: api.attrApiId,
      type: 'AWS_LAMBDA',
      lambdaConfig: {
        lambdaFunctionArn: notesLambda.functionArn
      },
      serviceRoleArn: appsyncDynamoRole.roleArn
    });

    // create api resolvers - resolvers for subscriptions are automatically created
    new CfnResolver(this, 'NoteQueryResolver', {
      apiId: api.attrApiId,
      typeName: 'Query',
      fieldName: 'listNotes',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);
    new CfnResolver(this, 'NoteQueryResolverSingle', {
      apiId: api.attrApiId,
      typeName: 'Query',
      fieldName: 'getNoteById',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);
    new CfnResolver(this, 'NoteQueryResolverFiltered', {
      apiId: api.attrApiId,
      typeName: 'Query',
      fieldName: 'notesByCompletion',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);
    new CfnResolver(this, 'NoteMutationResolver', {
      apiId: api.attrApiId,
      typeName: 'Mutation',
      fieldName: 'createNote',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);
    new CfnResolver(this, 'NoteMutationResolverUpdate', {
      apiId: api.attrApiId,
      typeName: 'Mutation',
      fieldName: 'updateNote',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);
    new CfnResolver(this, 'NoteMutationResolverDelete', {
      apiId: api.attrApiId,
      typeName: 'Mutation',
      fieldName: 'deleteNote',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);

    // grant lambda full access to the db
    notesTable.grantFullAccess(notesLambda);


    new CfnOutput(this, 'GraphQLAPIURL', {
      value: api.attrGraphQlUrl,
      exportName: 'GraphQLAPIURL'
    });

    new CfnOutput(this, 'GraphQLAPIKey', {
      value: apiKey.attrApiKey,
      exportName: 'GraphQLAPIKey'
    });

    new CfnOutput(this, 'AppSyncNotesUPId', {
      value: userPool.userPoolId,
      exportName: 'AppSyncNotesUPId'
    });

    new CfnOutput(this, 'AppSyncNotesUPClientId', {
      value: userPoolClient.userPoolClientId,
      exportName: 'AppSyncNotesUPClientId'
    });
  }
}
