#!/usr/bin/env ts-node
/* eslint-disable no-console */
import { Command } from 'commander';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-browser';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import getStream from 'get-stream';

const log = console;

const credentialsProvider = defaultProvider();

/**
 * Sign/presign and send the requests
 * @param url
 */
async function sendSignedRequest(url: URL, service: string) {
  const hostname = url.hostname;

  // Parse the region out of the Lambda URL
  const region = hostname.split('.')[2];

  const credentials = await credentialsProvider();
  const signer = new SignatureV4({
    credentials,
    region,
    service,
    sha256: Sha256,
  });
  // This issue claims that the session token being present during presign causes a problem
  // Perhaps that is some glitch specific to AWS IOT... it does not appear
  // to be a problem for AWS Lambda URLs
  // https://github.com/aws/aws-sdk-js-v3/issues/3417?msclkid=60ca6771c71211ec9f10bd8d6d086432
  const presigner = new SignatureV4({
    // credentials: { ...credentials, sessionToken: undefined },
    credentials,
    region,
    service,
    sha256: Sha256,
  });

  const request = new HttpRequest({
    hostname,
    headers: {
      host: hostname,
    },
    method: 'GET',
    path: url.pathname,
    port: 443,
    protocol: 'https:',
    // query: {},
  });
  url.searchParams.forEach((value, key) => {
    request.query[key] = value;
    log.info({ key, value }, 'query');
  });

  const presignedRequest = (await presigner.presign(request)) as HttpRequest;

  // Workaround needed for this issue with IOT, in combination with the above workaround
  // Leaving this here for reference
  // https://github.com/aws/aws-sdk-js-v3/issues/3417?msclkid=60ca6771c71211ec9f10bd8d6d086432
  // const presignedRequest = (await presigner.presign(request).then((req) => {
  //   if (typeof credentials.sessionToken === 'string' && typeof req.query === 'object') {
  //     req.query['X-Amz-Security-Token'] = credentials.sessionToken;
  //   }
  //   return req;
  // })) as HttpRequest;

  const signedRequest = (await signer.sign(request)) as HttpRequest;

  // Send the signed request
  log.info(signedRequest, 'signedRequest');
  log.info('------------------------------------\n');
  await sendRequest(signedRequest, 'signedRequest');

  // Send the presigned request
  log.info(presignedRequest, 'presignedRequest');
  log.info('------------------------------------\n');
  await sendRequest(presignedRequest, 'presignedRequest');
}

/**
 * Send the request to the Lambda URL
 * @param presignedRequest
 */
async function sendRequest(presignedRequest: HttpRequest, title: string) {
  log.info(`Sending ${title} request`);
  const client = new NodeHttpHandler();
  const { response } = await client.handle(presignedRequest);
  const responseNoBody = { headers: response.headers, statusCode: response.statusCode };
  log.info({ responseNoBody }, 'response without body');
  if (response.body) {
    log.info({ body: (await getStream(response.body)).slice(0, 2000) }, 'body preview');
  }
  log.info('------------------------------------\n');
}

const program = new Command();

program
  .name('lambda-sign-url')
  .description('Sign and invoke a Lambda URL using AWS Signature Version 4')
  .version('1.0.0')
  .option('-s, --service [service]', 'The AWS service to use (default: lambda)', 'lambda')
  .argument('<url>', 'Lambda URL to sign and invoke');

program.parse();

async function main() {
  const url = new URL(program.processedArgs[0]);
  await sendSignedRequest(url, program.opts().service);
}

void main();
