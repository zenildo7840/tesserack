// llm.js - WebLLM wrapper
import * as webllm from '@mlc-ai/web-llm';

let engine = null;

export async function initLLM(onProgress) {
    const selectedModel = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

    engine = await webllm.CreateMLCEngine(selectedModel, {
        initProgressCallback: (progress) => {
            if (onProgress) {
                onProgress(progress);
            }
        }
    });

    return engine;
}

export async function generate(prompt, maxTokens = 256) {
    if (!engine) {
        throw new Error('LLM not initialized');
    }

    const response = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.7,
    });

    return response.choices[0].message.content;
}

export function isReady() {
    return engine !== null;
}
