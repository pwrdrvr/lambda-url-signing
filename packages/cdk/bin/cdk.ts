#!/usr/bin/env node
import 'source-map-support/register';
import { App, Environment, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack';

const app = new App();

const env: Environment = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

const stackName = `lambda-url-signing${
  process.env.PR_NUMBER ? `-pr-${process.env.PR_NUMBER}` : ''
}`;

Tags.of(app).add('ApplicationName', stackName);

new AppStack(app, 'lambda-url-signing', {
  env,
  local: {
    removalPolicy: RemovalPolicy.DESTROY,
    useABACPermissions: true,
  },
  stackName,
});
