    /**
    * TranslatorAI_Main.gs
    *
        * Native LanguageApp translation endpoint for frontend requests.
    * Send POST body as JSON string with Content-Type: text/plain.
    */
    var HF_TRANSLATOR_CONFIG = {
            MODEL_NAME: 'GoogleAppsScript.LanguageApp',
            PROVIDER: 'languageapp',
        DEFAULT_SOURCE_LANG: 'eng_Latn',
        DEFAULT_TARGET_LANG: 'tgl_Latn',
        MAX_INPUT_CHARS: 5000,
        MAX_RETRY_ATTEMPTS: 2,
        RETRY_DELAY_MS: 1200
    };

    function doGet() {
        return createTranslatorJsonResponse_({
            success: true,
            status: 'online',
            service: 'TranslatorAI',
            model: HF_TRANSLATOR_CONFIG.MODEL_NAME,
            provider: HF_TRANSLATOR_CONFIG.PROVIDER,
            timestamp: new Date().toISOString()
        });
    }

    function doPost(e) {
        try {
            var request = parseTranslatorRequest_(e);
            var translationPayload = buildTranslationPayload_(request);

            return createTranslatorJsonResponse_(Object.assign({ success: true }, translationPayload));
        } catch (error) {
            Logger.log('Translator doPost error: ' + (error && error.stack ? error.stack : error));
            var code = error && error.code ? Number(error.code) : 500;
            return createTranslatorJsonResponse_({
                success: false,
                error: error && error.message ? error.message : 'Server error',
                code: isNaN(code) ? 500 : code
            });
        }
    }

    /**
    * Shared router entry for SystemTools_Main.gs action: "translateText".
    */
    function handleTranslateText(requestData) {
        try {
            var translationPayload = buildTranslationPayload_(requestData || {});

            if (typeof createSuccessResponse === 'function') {
                return createSuccessResponse(translationPayload);
            }

            return createTranslatorJsonResponse_(Object.assign({ success: true }, translationPayload));
        } catch (error) {
            var message = error && error.message ? error.message : 'Server error';
            var code = error && error.code ? Number(error.code) : 500;
            if (isNaN(code)) code = 500;

            if (typeof createErrorResponse === 'function') {
                return createErrorResponse(message, code);
            }

            return createTranslatorJsonResponse_({
                success: false,
                error: message,
                code: code
            });
        }
    }

    function parseTranslatorRequest_(e) {
        var raw = e && e.postData && typeof e.postData.contents === 'string'
            ? e.postData.contents
            : '';

        if (!raw) return {};

        try {
            return JSON.parse(raw);
        } catch (parseError) {
            throw new Error('Invalid JSON payload. Send a JSON string with Content-Type: text/plain.');
        }
    }

    function buildTranslationPayload_(request) {
        var text = normalizeTextValue_(request.text || request.inputText || '');
        var sourceLanguage = normalizeLanguageCode_(
            request.sourceLanguage || request.sourceLang,
            HF_TRANSLATOR_CONFIG.DEFAULT_SOURCE_LANG
        );
        var targetLanguage = normalizeLanguageCode_(
            request.targetLanguage || request.targetLang,
            HF_TRANSLATOR_CONFIG.DEFAULT_TARGET_LANG
        );

        if (!text) {
            throw createTranslatorError_('Missing required field: text', 400);
        }

        if (text.length > HF_TRANSLATOR_CONFIG.MAX_INPUT_CHARS) {
            throw createTranslatorError_(
                'Text is too long. Maximum characters: ' + HF_TRANSLATOR_CONFIG.MAX_INPUT_CHARS,
                413
            );
        }

        var translation;
        try {
            translation = {
                translatedText: translateWithLanguageApp_(text, sourceLanguage, targetLanguage),
                keyIndex: 0,
                model: HF_TRANSLATOR_CONFIG.MODEL_NAME
            };
        } catch (error) {
            throw createTranslatorError_(
                'LanguageApp translation failed: ' + (error && error.message ? error.message : String(error)),
                502
            );
        }

        return {
            translatedText: translation.translatedText,
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
            model: translation.model,
            keyIndexUsed: translation.keyIndex,
            provider: HF_TRANSLATOR_CONFIG.PROVIDER
        };
    }

    function createTranslatorError_(message, code) {
        var error = new Error(message);
        error.code = code || 500;
        return error;
    }

    function translateWithFailover_(text, sourceLanguage, targetLanguage, apiKeys) {
        var errors = [];

        for (var i = 0; i < apiKeys.length; i++) {
            try {
                var result = requestTranslationWithModelFallback_(text, sourceLanguage, targetLanguage, apiKeys[i]);
                return {
                    translatedText: result.translatedText,
                    keyIndex: i + 1,
                    model: result.model
                };
            } catch (error) {
                var message = error && error.message ? error.message : String(error);
                errors.push('key #' + (i + 1) + ': ' + message);
                Logger.log('[TranslatorAI] Failover key #' + (i + 1) + ' failed: ' + message);
            }
        }

        var allEndpoint404 = errors.length > 0 && errors.every(function (entry) {
            return entry.indexOf('HTTP 404') !== -1;
        });

        if (allEndpoint404) {
            throw new Error(
                'Translation endpoint returned HTTP 404 for every key. ' +
                'This usually means the model URL/provider route is invalid or unavailable, not that Script Properties are missing.'
            );
        }

        throw new Error('All Hugging Face API keys failed. ' + errors.join(' | '));
    }

    function requestTranslationWithModelFallback_(text, sourceLanguage, targetLanguage, apiKey) {
        var candidates = getTranslatorModelCandidates_();
        var modelErrors = [];

        for (var i = 0; i < candidates.length; i++) {
            var modelId = candidates[i];
            try {
                return requestTranslationForModel_(text, sourceLanguage, targetLanguage, apiKey, modelId);
            } catch (error) {
                var message = error && error.message ? error.message : String(error);
                modelErrors.push(modelId + ': ' + message);

                // Unauthorized keys should fail fast to next key.
                if (message.indexOf('HTTP 401') !== -1 || message.indexOf('HTTP 403') !== -1) {
                    throw error;
                }
            }
        }

        var allModel404 = modelErrors.length > 0 && modelErrors.every(function (entry) {
            return entry.indexOf('HTTP 404') !== -1;
        });

        if (allModel404) {
            throw new Error('HTTP 404 across all model candidates. ' + modelErrors.join(' | '));
        }

        throw new Error('Model fallback failed. ' + modelErrors.join(' | '));
    }

    function shouldUseLanguageAppFallback_(error) {
        if (HF_TRANSLATOR_CONFIG.ALLOW_LANGUAGEAPP_FALLBACK !== true) return false;

        var message = error && error.message ? error.message : String(error || '');
        if (!message) return false;

        return (
            message.indexOf('HTTP 404') !== -1 ||
            message.indexOf('Model fallback failed') !== -1 ||
            message.indexOf('Translation endpoint returned HTTP 404') !== -1
        );
    }

    function translateWithLanguageApp_(text, sourceLanguage, targetLanguage) {
        var sourceCode = toLanguageAppCode_(sourceLanguage) || 'auto';
        var targetCode = toLanguageAppCode_(targetLanguage);

        if (!targetCode) {
            throw new Error('LanguageApp fallback does not support target language code: ' + targetLanguage);
        }

        if (sourceCode === targetCode) {
            return text;
        }

        try {
            var translated = LanguageApp.translate(text, sourceCode, targetCode);
            translated = normalizeTextValue_(translated);
            if (!translated) {
                throw new Error('LanguageApp returned empty translation text.');
            }
            return translated;
        } catch (error) {
            throw new Error('LanguageApp fallback failed: ' + (error && error.message ? error.message : String(error)));
        }
    }

    function getTranslatorModelCandidates_() {
        var props = PropertiesService.getScriptProperties();
        var configuredList = splitApiKeys_(props.getProperty('HF_TRANSLATOR_MODEL_CANDIDATES'));
        var configuredPrimary = normalizeTextValue_(props.getProperty('HF_TRANSLATOR_MODEL'));
        var defaults = HF_TRANSLATOR_CONFIG.FALLBACK_MODELS || [];
        var raw = [];
        var seen = {};
        var out = [];

        if (configuredPrimary) raw.push(configuredPrimary);
        raw = raw.concat(configuredList);
        raw = raw.concat(defaults);

        for (var i = 0; i < raw.length; i++) {
            var modelId = normalizeTextValue_(raw[i]);
            if (!modelId || seen[modelId]) continue;
            seen[modelId] = true;
            out.push(modelId);
        }

        return out.length ? out : [HF_TRANSLATOR_CONFIG.MODEL_NAME];
    }

    function requestTranslationForModel_(text, sourceLanguage, targetLanguage, apiKey, modelId) {
        var isNllbLike = modelId.indexOf('nllb') !== -1;
        var normalizedSource = isNllbLike ? sourceLanguage : toIsoLanguageCode_(sourceLanguage);
        var normalizedTarget = isNllbLike ? targetLanguage : toIsoLanguageCode_(targetLanguage);

        if (!normalizedSource || !normalizedTarget) {
            throw new Error('Unsupported language code for model ' + modelId + '. source=' + sourceLanguage + ', target=' + targetLanguage);
        }

        var payload = {
            inputs: text,
            options: {
                wait_for_model: true
            }
        };

        if (isNllbLike) {
            payload.parameters = {
                src_lang: normalizedSource,
                tgt_lang: normalizedTarget
            };
        } else {
            payload.parameters = {
                src_lang: normalizedSource,
                tgt_lang: normalizedTarget
            };
        }

        var endpointUrl = 'https://router.huggingface.co/hf-inference/models/' + modelId;

        var maxAttempts = 1 + Number(HF_TRANSLATOR_CONFIG.MAX_RETRY_ATTEMPTS || 0);
        if (isNaN(maxAttempts) || maxAttempts < 1) {
            maxAttempts = 1;
        }

        var lastError = '';

        for (var attempt = 1; attempt <= maxAttempts; attempt++) {
            var response = UrlFetchApp.fetch(endpointUrl, {
                method: 'post',
                contentType: 'application/json',
                headers: {
                    Authorization: 'Bearer ' + apiKey
                },
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            });

            var status = response.getResponseCode();
            var rawBody = response.getContentText() || '';
            var parsedBody = safeParseJson_(rawBody);

            if (status >= 200 && status < 300) {
                var translatedText = extractTranslatedText_(parsedBody);
                if (!translatedText) {
                    throw new Error('Translation API returned no translated text.');
                }
                return {
                    translatedText: translatedText,
                    model: modelId
                };
            }

            var apiError = extractErrorMessage_(parsedBody) || ('Hugging Face request failed with status ' + status);
            lastError = apiError;

            if (status === 401 || status === 403) {
                throw new Error('HTTP ' + status + ': Unauthorized API key/token.');
            }

            if (status === 404) {
                throw new Error('HTTP 404: ' + apiError);
            }

            if (status === 429) {
                if (attempt < maxAttempts) {
                    Utilities.sleep(resolveRetryDelayMs_(parsedBody, attempt));
                    continue;
                }
                throw new Error('HTTP 429: Quota exceeded or rate limited.');
            }

            if ((status === 503 || status >= 500) && attempt < maxAttempts) {
                Utilities.sleep(resolveRetryDelayMs_(parsedBody, attempt));
                continue;
            }

            throw new Error('HTTP ' + status + ': ' + apiError);
        }

        throw new Error(lastError || 'Translation request failed.');
    }

    function toIsoLanguageCode_(value) {
        var normalized = normalizeTextValue_(value);
        if (!normalized) return '';

        var directMap = {
            eng_Latn: 'en',
            tgl_Latn: 'tl',
            ceb_Latn: 'ceb',
            ilo_Latn: 'ilo',
            hil_Latn: 'tl',
            war_Latn: 'tl',
            bik_Latn: 'tl',
            pam_Latn: 'tl',
            pag_Latn: 'tl',
            spa_Latn: 'es',
            fra_Latn: 'fr',
            deu_Latn: 'de',
            ita_Latn: 'it',
            por_Latn: 'pt',
            nld_Latn: 'nl',
            rus_Cyrl: 'ru',
            zho_Hans: 'zh-CN',
            kor_Hang: 'ko',
            ind_Latn: 'id',
            msa_Latn: 'ms',
            hin_Deva: 'hi',
            tha_Thai: 'th',
            vie_Latn: 'vi',
            ara_Arab: 'ar',
            arb_Arab: 'ar',
            tur_Latn: 'tr',
            ukr_Cyrl: 'uk',
            jpn_Jpan: 'ja'
        };

        if (directMap[normalized]) return directMap[normalized];

        var parts = normalized.split('_');
        return parts.length ? parts[0].toLowerCase() : normalized.toLowerCase();
    }

    function toLanguageAppCode_(value) {
        var normalized = normalizeTextValue_(value);
        if (!normalized) return '';

        var directMap = {
            eng_Latn: 'en',
            tgl_Latn: 'tl',
            ceb_Latn: 'ceb',
            ilo_Latn: 'ilo',
            hil_Latn: 'tl',
            war_Latn: 'tl',
            bik_Latn: 'tl',
            pam_Latn: 'tl',
            pag_Latn: 'tl',
            spa_Latn: 'es',
            fra_Latn: 'fr',
            deu_Latn: 'de',
            ita_Latn: 'it',
            por_Latn: 'pt',
            nld_Latn: 'nl',
            rus_Cyrl: 'ru',
            zho_Hans: 'zh-CN',
            kor_Hang: 'ko',
            ind_Latn: 'id',
            msa_Latn: 'ms',
            hin_Deva: 'hi',
            tha_Thai: 'th',
            vie_Latn: 'vi',
            ara_Arab: 'ar',
            arb_Arab: 'ar',
            tur_Latn: 'tr',
            ukr_Cyrl: 'uk',
            jpn_Jpan: 'ja'
        };

        if (directMap[normalized]) return directMap[normalized];

        var iso = toIsoLanguageCode_(normalized);
        return iso || normalized.toLowerCase();
    }

    function resolveRetryDelayMs_(payload, attempt) {
        var baseDelay = Number(HF_TRANSLATOR_CONFIG.RETRY_DELAY_MS || 1200);
        if (isNaN(baseDelay) || baseDelay < 250) {
            baseDelay = 1200;
        }

        var computedDelay = baseDelay * Math.max(1, attempt);
        if (payload && typeof payload.estimated_time === 'number') {
            var estimatedDelay = Math.round(payload.estimated_time * 1000);
            if (!isNaN(estimatedDelay) && estimatedDelay > computedDelay) {
                computedDelay = estimatedDelay;
            }
        }

        return Math.min(10000, Math.max(500, computedDelay));
    }

    function extractTranslatedText_(payload) {
        if (typeof payload === 'string') {
            return payload.trim();
        }

        if (payload && typeof payload === 'object') {
            if (typeof payload.translation_text === 'string') {
                return payload.translation_text.trim();
            }
            if (typeof payload.generated_text === 'string') {
                return payload.generated_text.trim();
            }
        }

        if (Array.isArray(payload) && payload.length > 0) {
            var first = payload[0];
            if (first && typeof first.translation_text === 'string') {
                return first.translation_text.trim();
            }
            if (first && typeof first.generated_text === 'string') {
                return first.generated_text.trim();
            }
            if (first && typeof first.text === 'string') {
                return first.text.trim();
            }
        }

        return '';
    }

    function extractErrorMessage_(payload) {
        if (!payload) return '';

        if (typeof payload === 'string') {
            return payload.trim();
        }

        if (typeof payload.error === 'string') {
            return payload.error.trim();
        }

        if (Array.isArray(payload.errors) && payload.errors.length > 0) {
            return payload.errors.join('; ');
        }

        return '';
    }

    function safeParseJson_(value) {
        if (!value) return null;
        try {
            return JSON.parse(value);
        } catch (error) {
            return value;
        }
    }

    function getHuggingFaceApiKeys_() {
        var props = PropertiesService.getScriptProperties().getProperties() || {};
        var rawKeys = [];
        var seen = {};
        var uniqueKeys = [];

        // Option 1: comma/newline-separated lists in one Script Property.
        rawKeys = rawKeys.concat(splitApiKeys_(props.HF_NLLB_API_KEYS));
        rawKeys = rawKeys.concat(splitApiKeys_(props.HF_API_KEYS));
        rawKeys = rawKeys.concat(splitApiKeys_(props.HUGGINGFACE_API_KEYS));
        rawKeys = rawKeys.concat(splitApiKeys_(props.HF_TOKENS));

        // Option 2: numbered properties for failover rotation.
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HF_API_KEY'));
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HUGGINGFACE_API_KEY'));
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HF_NLLB_API_KEY'));
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HF_TOKEN'));
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HUGGINGFACE_TOKEN'));
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HF_TRANSLATOR_API_KEY'));
        rawKeys = rawKeys.concat(getPrefixedPropertyValues_(props, 'HF_TRANSLATOR_TOKEN'));

        for (var i = 0; i < rawKeys.length; i++) {
            var key = normalizeTextValue_(rawKeys[i]);
            if (!key || seen[key]) continue;
            seen[key] = true;
            uniqueKeys.push(key);
        }

        return uniqueKeys;
    }

    function splitApiKeys_(rawValue) {
        var raw = normalizeTextValue_(rawValue);
        if (!raw) return [];

        return raw
            .split(/[\n,]+/)
            .map(function (value) { return normalizeTextValue_(value); })
            .filter(function (value) { return !!value; });
    }

    function getPrefixedPropertyValues_(props, baseName) {
        var propKeys = Object.keys(props || {}).filter(function (name) {
            return name === baseName || name.indexOf(baseName + '_') === 0;
        });

        propKeys.sort(function (a, b) {
            return parsePropertySuffix_(a, baseName) - parsePropertySuffix_(b, baseName);
        });

        return propKeys
            .map(function (name) { return normalizeTextValue_(props[name]); })
            .filter(function (value) { return !!value; });
    }

    function parsePropertySuffix_(name, baseName) {
        if (name === baseName) return 0;
        var suffix = name.slice((baseName + '_').length);
        var parsed = parseInt(suffix, 10);
        if (isNaN(parsed)) return 1000000;
        return parsed;
    }

    function normalizeTextValue_(value) {
        return String(value || '').trim();
    }

    function normalizeLanguageCode_(value, fallback) {
        var normalized = normalizeTextValue_(value);
        return normalized || fallback;
    }

    function createTranslatorJsonResponse_(payload) {
        return ContentService
            .createTextOutput(JSON.stringify(payload))
            .setMimeType(ContentService.MimeType.JSON);
    }
