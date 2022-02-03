import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnApiKey,
  CfnDataSource,
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnResolver
} from 'aws-cdk-lib/aws-appsync';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';


export class NadetGraphQlAppSyncStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const notesTable = new Table(this, 'AppSyncNotesTable', {
      tableName: 'AppSyncNotesTable',
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING
      }
    });

    const api = new CfnGraphQLApi(this, 'GraphQLAPI', {
      name: 'GraphQLAPI',
      authenticationType: 'API_KEY',
      xrayEnabled: true,
    });

    const apiKey = new CfnApiKey(this, 'GraphQLAPIkey', {
      apiId: api.attrApiId,
    });

    const schema = new CfnGraphQLSchema(this, 'GraphQLSchema', {
      apiId: api.attrApiId,
      definition: require('../graphql/schema.graphql')
    });

    new CfnOutput(this, 'GraphQLAPIURL', {
      value: api.attrGraphQlUrl,
      exportName: 'GraphQLAPIURL'
    });

    new CfnOutput(this, 'GraphQLAPIKey', {
      value: apiKey.attrApiKey,
      exportName: 'GraphQLAPIKey'
    });

    const notesLambda = new NodejsFunction(this, 'NotesAPIhandler', {
      functionName: 'NotesAPIhandler',
      runtime: Runtime.NODEJS_14_X,
      handler: 'handler',
      entry: join(__dirname, '..', 'lambdas', 'main.ts'),
      environment: {
        NOTES_TABLE: notesTable.tableName
      } 
    });
    notesTable.grantFullAccess(notesLambda);

    const dataSource = new CfnDataSource(this, 'NoteHandlerDataSource', {
      name: 'NoteHandlerDataSource',
      apiId: api.attrApiId,
      type: 'AWS_LAMBDA',
      lambdaConfig: {
        lambdaFunctionArn: notesLambda.functionArn
      },
      dynamoDbConfig: {
        tableName: 'AppSyncNotesTable',
        awsRegion: props?.env?.region!
      }
    });

    // resolvers for subscriptions are automatically created
    new CfnResolver(this, 'NoteQueryResolver', {
      apiId: api.attrApiId,
      typeName: 'Query',
      fieldName: 'listNotes',
      dataSourceName: dataSource.name
    });

    new CfnResolver(this, 'NoteMutationResolver', {
      apiId: api.attrApiId,
      typeName: 'Mutation',
      fieldName: 'createNote',
      dataSourceName: dataSource.name
    });
  }
}
