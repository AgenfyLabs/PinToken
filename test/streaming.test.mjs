/**
 * SSE streaming 解析器测试
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAnthropicSSE,
  parseOpenAISSE,
  parseAnthropicResponse,
  parseOpenAIResponse,
} from '../src/proxy/streaming.mjs';

// ─── parseAnthropicSSE ────────────────────────────────────────────────────────

describe('parseAnthropicSSE', () => {
  it('从标准 SSE 中提取 model 和 token 用量', () => {
    const raw = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_01","type":"message","role":"assistant","model":"claude-3-5-sonnet-20241022","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":25,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":1}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":10}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join('\n');

    const result = parseAnthropicSSE(raw);
    assert.ok(result !== null, '结果不应为 null');
    assert.equal(result.model, 'claude-3-5-sonnet-20241022');
    assert.equal(result.input_tokens, 25);
    assert.equal(result.output_tokens, 10);
    assert.equal(result.cache_read_tokens, 0);
    assert.equal(result.cache_write_tokens, 0);
  });

  it('提取含 cache token 的用量', () => {
    const raw = [
      'event: message_start',
      'data: {"type":"message_start","message":{"model":"claude-3-opus-20240229","usage":{"input_tokens":100,"cache_creation_input_tokens":50,"cache_read_input_tokens":200,"output_tokens":1}}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{},"usage":{"output_tokens":42}}',
      '',
    ].join('\n');

    const result = parseAnthropicSSE(raw);
    assert.ok(result !== null);
    assert.equal(result.model, 'claude-3-opus-20240229');
    assert.equal(result.input_tokens, 100);
    assert.equal(result.output_tokens, 42);
    assert.equal(result.cache_read_tokens, 200);
    assert.equal(result.cache_write_tokens, 50);
  });

  it('没有 message_start 时返回 null', () => {
    const raw = [
      'event: message_delta',
      'data: {"type":"message_delta","delta":{},"usage":{"output_tokens":5}}',
      '',
    ].join('\n');

    const result = parseAnthropicSSE(raw);
    assert.equal(result, null);
  });
});

// ─── parseOpenAISSE ───────────────────────────────────────────────────────────

describe('parseOpenAISSE', () => {
  it('从 OpenAI SSE 中提取 model 和 token 用量', () => {
    const raw = [
      'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
      '',
      'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}',
      '',
      'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":15,"completion_tokens":8,"total_tokens":23}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const result = parseOpenAISSE(raw);
    assert.ok(result !== null);
    assert.equal(result.model, 'gpt-4o');
    assert.equal(result.input_tokens, 15);
    assert.equal(result.output_tokens, 8);
    assert.equal(result.cache_read_tokens, 0);
    assert.equal(result.cache_write_tokens, 0);
  });

  it('没有 usage 字段时返回 null', () => {
    const raw = [
      'data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":"stop"}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const result = parseOpenAISSE(raw);
    assert.equal(result, null);
  });
});

// ─── parseAnthropicResponse ───────────────────────────────────────────────────

describe('parseAnthropicResponse', () => {
  it('从非流式 Anthropic 响应中提取用量', () => {
    const body = {
      id: 'msg_01',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-5-haiku-20241022',
      content: [{ type: 'text', text: 'Hello' }],
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 30,
        output_tokens: 20,
        cache_creation_input_tokens: 10,
        cache_read_input_tokens: 5,
      },
    };

    const result = parseAnthropicResponse(body);
    assert.ok(result !== null);
    assert.equal(result.model, 'claude-3-5-haiku-20241022');
    assert.equal(result.input_tokens, 30);
    assert.equal(result.output_tokens, 20);
    assert.equal(result.cache_write_tokens, 10);
    assert.equal(result.cache_read_tokens, 5);
  });

  it('缺少 usage 字段时返回 null', () => {
    const result = parseAnthropicResponse({ model: 'claude-3-opus-20240229' });
    assert.equal(result, null);
  });
});

// ─── parseOpenAIResponse ──────────────────────────────────────────────────────

describe('parseOpenAIResponse', () => {
  it('从非流式 OpenAI 响应中提取用量', () => {
    const body = {
      id: 'chatcmpl-xyz',
      object: 'chat.completion',
      model: 'gpt-4o-mini',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 },
    };

    const result = parseOpenAIResponse(body);
    assert.ok(result !== null);
    assert.equal(result.model, 'gpt-4o-mini');
    assert.equal(result.input_tokens, 12);
    assert.equal(result.output_tokens, 6);
    assert.equal(result.cache_read_tokens, 0);
    assert.equal(result.cache_write_tokens, 0);
  });

  it('缺少 usage 字段时返回 null', () => {
    const result = parseOpenAIResponse({ model: 'gpt-4o' });
    assert.equal(result, null);
  });
});
