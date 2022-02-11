#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GraphQlAppSyncStack } from '../lib/graph_ql-appsync-stack';

const app = new cdk.App();
new GraphQlAppSyncStack(app, 'GraphQlAppsyncStack', {
  stackName: 'GraphQlAppsyncStack',
  env: {
    region: 'eu-west-1'
  },
});