import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnApiKey,
  CfnDataSource,
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnResolver
} from 'aws-cdk-lib/aws-appsync';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

export class NadetGraphQlAppSyncStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Api data table
    const notesTable = new Table(this, 'AppSyncNotesTable', {
      tableName: 'AppSyncNotesTable',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      }
    });

    // Api itself
    const api = new CfnGraphQLApi(this, 'GraphQLAPI', {
      name: 'GraphQLAPI',
      authenticationType: 'API_KEY',
      xrayEnabled: true,
    });

    const apiKey = new CfnApiKey(this, 'GraphQLAPIkey', {
      apiId: api.attrApiId,
    });

    // api data schema
    const schema = new CfnGraphQLSchema(this, 'GraphQLSchema', {
      apiId: api.attrApiId,
      definition: `
        schema {
          query: Query
          mutation: Mutation
        }

        type Note {
          id: ID!
          name: String!,
          complete: Boolean!
        }

        input NoteInput {
          id: ID!
          name: String!
          complete: Boolean!
        }

        type Query {
          listNotes: [Note]
        }

        type Mutation {
          createNote(note: NoteInput!): Note
        }

        type Subscription {
          onCreateNote: Note

          @aws_subscribe(mutations: ["createNote"])
        }
      `
    });

    new CfnOutput(this, 'GraphQLAPIURL', {
      value: api.attrGraphQlUrl,
      exportName: 'GraphQLAPIURL'
    });

    new CfnOutput(this, 'GraphQLAPIKey', {
      value: apiKey.attrApiKey,
      exportName: 'GraphQLAPIKey'
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

    // connect datasource to the api
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

    new CfnResolver(this, 'NoteMutationResolver', {
      apiId: api.attrApiId,
      typeName: 'Mutation',
      fieldName: 'createNote',
      dataSourceName: dataSource.name
    }).addDependsOn(schema);

    // grant lambda full access to the db
    notesTable.grantFullAccess(notesLambda);
  }
}
