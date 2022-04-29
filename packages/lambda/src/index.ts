/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type lambda from 'aws-lambda';
import { promisify } from 'util';
const sleep = promisify(setTimeout);

async function cheesyInit() {
  console.log('cheesyInit - started');
  try {
    console.log(`cheesyInit - __dirname working (it should not since this is ESM)?: ${__dirname}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log(`cheesyInit - __dirname failed (it should fail since this is ESM): ${e.message}`);
  }
  await sleep(5000);
  console.log('cheesyInit - done');
}

await cheesyInit();

export async function handler(
  event: lambda.ALBEvent,
  context: lambda.Context,
  callback: lambda.ALBCallback,
): Promise<lambda.ALBResult | undefined> {
  console.log('hi mom!');
  await sleep(100);
  console.log('bye mom!');

  return {
    isBase64Encoded: false,
    statusCode: 200,
    statusDescription: 'OK',
    body: 'hi mom!',
  };
}
