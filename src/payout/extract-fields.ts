export interface ExtractedPayoutFields {
  externalId?: string;
  cardNumber?: string;
}

export function extractAdditionalField(
  body: unknown,
  fieldName: string,
): string | undefined {
  if (!isRecord(body) || !Array.isArray(body.additionalFields)) {
    return undefined;
  }

  const match = body.additionalFields.find((item) => {
    if (!isRecord(item) || typeof item.key !== 'string') {
      return false;
    }
    return item.key.toLowerCase() === fieldName.toLowerCase();
  });

  if (!match || match.value == null) {
    return undefined;
  }

  return String(match.value);
}

export function extractExternalId(data: unknown): string | undefined {
  if (!isRecord(data) || data.externalId == null) {
    return undefined;
  }
  return String(data.externalId);
}

export function extractPayoutFields(
  requestBody: unknown,
  responseBody: unknown,
): ExtractedPayoutFields {
  return {
    externalId:
      extractExternalId(responseBody) ?? extractExternalId(requestBody),
    cardNumber: extractAdditionalField(requestBody, 'CardNumber'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
