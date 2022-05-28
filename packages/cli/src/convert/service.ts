/**
 * Extract AWS service name from non-customized hostnames
 *
 * Examples:
 *  - API Gateway: [api-id].execute-api.us-east-1.amazonaws.com
 *  - Lambda Function URL: [function-url-id].lambda-url.us-east-1.on.aws
 * @param hostname
 * @returns
 */
export function getServiceFromHostname(hostname: string): string | undefined {
  const parts = hostname.split('.');
  if (parts.length >= 2 && parts[1] !== undefined) {
    const serviceCandidate = parts[1];
    if (serviceCandidate.match(/^(lambda-url|execute-api)$/)) {
      if (serviceCandidate === 'lambda-url') {
        return 'lambda';
      }
      return serviceCandidate;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}
