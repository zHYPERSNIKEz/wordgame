# Dictionary API Research for Portuguese Word Game

## Summary
After researching multiple dictionary APIs, we have identified the best options for a Portuguese word game application.

## Selected API: FreeDictionaryAPI.com

**Why FreeDictionaryAPI.com:**
- **Portuguese Support**: Provides 404,401+ Portuguese words
- **Multilingual**: Supports multiple languages including Portuguese (pt)
- **No API Key Required**: Completely free with no authentication needed
- **Rate Limits**: 1,000 requests per hour per IP address
- **CORS Enabled**: Can be called directly from frontend or backend
- **Well-Documented**: OpenAPI 3.0 specification available
- **Rich Data**: Returns definitions, examples, synonyms, antonyms, translations, and part of speech

### API Endpoint
```
GET https://freedictionaryapi.com/api/v1/entries/{language}/{word}
GET https://freedictionaryapi.com/api/v1/entries/pt/palavra
```

### Response Structure
```json
{
  "word": "string",
  "entries": [{
    "language": {
      "code": "string",
      "name": "string"
    },
    "partOfSpeech": "string",
    "pronunciations": [{
      "type": "string",
      "text": "string"
    }],
    "senses": [{
      "definition": "string",
      "examples": ["string"],
      "synonyms": ["string"],
      "antonyms": ["string"]
    }]
  }],
  "source": {
    "url": "string",
    "license": {
      "name": "string",
      "url": "string"
    }
  }
}
```

## Alternative Options Considered

### 1. Dicionário Aberto API
- **URL**: https://api.dicionario-aberto.net/
- **Pros**: Portuguese-specific, open source, comprehensive
- **Cons**: Complex XML response format, less documentation, slower response times
- **Status**: Not selected due to complexity

### 2. Free Dictionary API (dictionaryapi.dev)
- **URL**: https://dictionaryapi.dev/
- **Pros**: Simple API, well-documented
- **Cons**: English-only, not suitable for Portuguese words
- **Status**: Not selected

### 3. Lingvanex Portuguese Dictionary API
- **URL**: https://lingvanex.com/services/portuguese-dictionary-api/
- **Pros**: Professional, comprehensive
- **Cons**: Requires API key, paid service
- **Status**: Not selected due to cost

## Implementation Strategy

1. **Backend Integration**: Create a tRPC procedure to fetch words from FreeDictionaryAPI
2. **Caching**: Implement Redis/in-memory caching to reduce API calls and improve performance
3. **Word Selection**: Randomly select words from a pre-cached list for game sessions
4. **Error Handling**: Gracefully handle API failures with fallback words
5. **Rate Limiting**: Monitor API usage to stay within 1,000 requests/hour limit

## Attribution Requirements
- Link back to original Wiktionary page (provided in API response)
- Include visible attribution to FreeDictionaryAPI.com
- For downloadable apps, add attribution on distribution landing page

## Conclusion
FreeDictionaryAPI.com is the best choice for this project due to its Portuguese language support, free access, no API key requirement, and comprehensive documentation. The API provides all necessary data (definitions, examples, synonyms) to create an engaging word game experience.
