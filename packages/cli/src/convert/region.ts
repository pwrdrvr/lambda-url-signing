export function getRegionFromHostname(hostname: string) {
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[2] !== undefined) {
    const regionCandidate = parts[2];

    // https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html
    if (
      regionCandidate.match(/^[a-z]{2}-[a-z]{4,}-\d{1}$/) ||
      regionCandidate.match(/^[a-z]{2}-[a-z]{3}-[a-z]{4,}-\d{1}$/)
    ) {
      return regionCandidate;
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}
