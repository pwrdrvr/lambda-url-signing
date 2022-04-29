#!/usr/bin/env node
import 'source-map-support/register';
import { App, Duration } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack';

const app = new App();

new AppStack(app, 'lambda-url-signing', {
  local: {
    ttl: Duration.days(1),
  },
});
