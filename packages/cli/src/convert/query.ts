import { QueryParameterBag } from '@aws-sdk/types';

export function convertQuery(urlSearchParams: URLSearchParams): QueryParameterBag {
  const queryMap: QueryParameterBag = {};

  if (urlSearchParams) {
    urlSearchParams.forEach((value, key) => {
      if (queryMap[key] === undefined || queryMap[key] === null) {
        queryMap[key] = value;
      } else if (Array.isArray(queryMap[key])) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        (queryMap[key]! as Array<string>).push(value);
      } else {
        queryMap[key] = [queryMap[key] as string, value];
      }
    });
  }

  return queryMap;
}
