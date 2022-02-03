#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NadetGraphQlAppSyncStack } from '../lib/nadet-graph_ql-appsync-stack';

const app = new cdk.App();
new NadetGraphQlAppSyncStack(app, 'NadetGraphQlAppsyncStack', {
  stackName: 'NadetGraphQlAppsyncStack',
  env: {
    region: 'eu-west-1'
  },
});