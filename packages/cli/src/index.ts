#!/usr/bin/env ts-node
/* eslint-disable no-console */
import { Command } from 'commander';
import { convertRequest } from './convert/request';
import { getRegionFromHostname } from './convert/region';
import { signRequest } from './sign';
import { sendRequest } from './send';
import { getServiceFromHostname } from './convert/service';

const log = console;

const program = new Command();

program
  .name('aws-sign-url')
  .description(
    'Sign and invoke a Lambda Function URL or API Gateway Execute-API URL using AWS Signature Version 4',
  )
  .version('1.0.0')
  .option(
    '-s, --service [service]',
    'The AWS service to sign the request for (default: determined from URL if it contains execute-api or lambda-url)',
  )
  .option(
    '-r, --region [region]',
    'The AWS region the endpoint resides in (default: determined from URL)',
  )
  .argument('<url>', 'Lambda URL to sign and invoke');

program.parse();

async function main() {
  const url = new URL(program.processedArgs[0]);
  const request = convertRequest(url);
  const region = program.opts().region ?? getRegionFromHostname(url.hostname);
  if (region === undefined) {
    throw new Error(
      `Could not determine region from hostname: ${url.hostname}, must specify region with --region [region]`,
    );
  }
  const service = program.opts().service ?? getServiceFromHostname(url.hostname);
  if (service === undefined) {
    throw new Error(
      `Could not determine service from hostname: ${url.hostname}, must specify service with --service [service]`,
    );
  }

  const { signedRequest, presignedRequest } = await signRequest(request, region, service);

  // Send the signed request
  log.info(signedRequest, 'signedRequest');
  log.info('------------------------------------\n');
  await sendRequest(signedRequest, 'signedRequest');

  // Send the presigned request
  log.info(presignedRequest, 'presignedRequest');
  log.info('------------------------------------\n');
  await sendRequest(presignedRequest, 'presignedRequest');
}

void main();
