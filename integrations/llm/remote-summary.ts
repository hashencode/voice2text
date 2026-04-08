export type RemoteSummaryProgress = {
    stage: 'building-request' | 'requesting' | 'parsing' | 'done';
    stageProgress: number;
    message: string;
};

export type RemoteSummaryResult = {
    summaryText: string;
    keyPoints: string[];
    actions: string[];
    decisions: string[];
    risks: string[];
    elapsedMs: number;
    model: string;
};

type JsonLike = Record<string, unknown>;

type RemoteSummaryOptions = {
    input: string;
    onProgress?: (progress: RemoteSummaryProgress) => void;
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-5-mini';

function getRemoteConfig(): { baseUrl: string; model: string; apiKey: string } {
    const baseUrl = (process.env.EXPO_PUBLIC_LLM_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model = process.env.EXPO_PUBLIC_LLM_MODEL ?? DEFAULT_MODEL;
    const apiKey = process.env.EXPO_PUBLIC_LLM_API_KEY ?? '';
    if (!apiKey) {
        throw new Error('缺少 EXPO_PUBLIC_LLM_API_KEY');
    }
    return { baseUrl, model, apiKey };
}

function parseArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(item => typeof item === 'string').map(item => item.trim()).filter(Boolean);
}

function buildSummaryText(parsed: { keyPoints: string[]; actions: string[]; decisions: string[]; risks: string[] }): string {
    const keyPoints = parsed.keyPoints.length > 0 ? parsed.keyPoints : ['未提取到明确要点，请人工复核。'];
    const actions = parsed.actions.length > 0 ? parsed.actions : ['未提取到明确待办，请人工复核。'];
    const decisions = parsed.decisions.length > 0 ? parsed.decisions : ['未提取到明确决策，请人工复核。'];
    const risks = parsed.risks.length > 0 ? parsed.risks : ['未提取到明确风险，请人工复核。'];
    return [
        '【要点】',
        ...keyPoints.map(item => `- ${item}`),
        '【待办】',
        ...actions.map(item => `- ${item}`),
        '【决策】',
        ...decisions.map(item => `- ${item}`),
        '【风险】',
        ...risks.map(item => `- ${item}`),
    ].join('\n');
}

function extractAssistantText(payload: JsonLike): string {
    const choices = payload.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
        throw new Error('远程 API 未返回 choices');
    }
    const first = choices[0] as JsonLike;
    const message = first.message as JsonLike | undefined;
    const content = message?.content;
    if (typeof content === 'string' && content.trim()) {
        return content.trim();
    }
    throw new Error('远程 API 返回内容为空');
}

export async function summarizeTextByRemoteApi(options: RemoteSummaryOptions): Promise<RemoteSummaryResult> {
    const input = options.input.trim();
    if (!input) {
        throw new Error('输入文本为空');
    }

    const { baseUrl, model, apiKey } = getRemoteConfig();
    const startedAt = Date.now();

    options.onProgress?.({
        stage: 'building-request',
        stageProgress: 0.1,
        message: '构建远程请求',
    });

    const systemPrompt = [
        '你是会议纪要分析助手。',
        '请只输出 JSON，不要输出任何额外文本。',
        'JSON schema: {"keyPoints":[string],"actions":[string],"decisions":[string],"risks":[string]}',
        '规则:',
        '1) 每个数组最多 5 条',
        '2) 缺失字段返回空数组',
        '3) 输出语言与输入语言一致',
    ].join('\n');

    options.onProgress?.({
        stage: 'requesting',
        stageProgress: 0.45,
        message: '请求远程推理 API',
    });

    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            temperature: 0.2,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: input },
            ],
            response_format: { type: 'json_object' },
        }),
    });

    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`远程 API 请求失败(${response.status}): ${text || 'unknown'}`);
    }

    options.onProgress?.({
        stage: 'parsing',
        stageProgress: 0.75,
        message: '解析远程响应',
    });

    const payload = (await response.json()) as JsonLike;
    const rawText = extractAssistantText(payload);
    let parsedJson: JsonLike = {};
    try {
        parsedJson = JSON.parse(rawText) as JsonLike;
    } catch {
        throw new Error('远程模型返回内容不是有效 JSON');
    }

    const keyPoints = parseArray(parsedJson.keyPoints);
    const actions = parseArray(parsedJson.actions);
    const decisions = parseArray(parsedJson.decisions);
    const risks = parseArray(parsedJson.risks);
    const summaryText = buildSummaryText({ keyPoints, actions, decisions, risks });

    options.onProgress?.({
        stage: 'done',
        stageProgress: 1,
        message: '远程摘要完成',
    });

    return {
        summaryText,
        keyPoints,
        actions,
        decisions,
        risks,
        elapsedMs: Date.now() - startedAt,
        model,
    };
}

