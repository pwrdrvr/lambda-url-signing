#!/usr/bin/env node
import 'source-map-support/register';
import { App, Duration, Environment } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack';

const app = new App();

const env: Environment = {
  region: process.env.CDK_DEFAULT_REGION,
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

new AppStack(app, 'lambda-url-signing', {
  env,
  local: {
    ttl: Duration.days(1),
  },
  stackName: `lambda-url-signing${process.env.PR_NUMBER ? `-pr-${process.env.PR_NUMBER}` : ''}`,
});
