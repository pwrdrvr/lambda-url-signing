import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-browser';
import { HttpRequest } from '@aws-sdk/protocol-http';

const credentialsProvider = defaultProvider();

/**
 * Sign/presign and send the requests
 * @param url
 */
export async function signRequest(request: HttpRequest, region: string, service: string) {
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

  return { signedRequest, presignedRequest };
}
