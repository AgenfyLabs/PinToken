/**
 * JSONL 行解析器测试
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferProvider, parseAssistantMessage } from '../src/scanner/parser.mjs';

// --- inferProvider 测试 ---

test('inferProvider: claude 模型 → anthropic', () => {
  assert.equal(inferProvider('claude-3-5-sonnet-20241022'), 'anthropic');
  assert.equal(inferProvider('claude-sonnet'), 'anthropic');
});

test('inferProvider: gpt 模型 → openai', () => {
  assert.equal(inferProvider('gpt-4o'), 'openai');
  assert.equal(inferProvider('gpt-3.5-turbo'), 'openai');
});

test('inferProvider: o1/o3 模型 → openai', () => {
  assert.equal(inferProvider('o1-mini'), 'openai');
  assert.equal(inferProvider('o3-pro'), 'openai');
});

test('inferProvider: 未知模型 → unknown', () => {
  assert.equal(inferProvider('gemini-pro'), 'unknown');
  assert.equal(inferProvider('llama-3'), 'unknown');
  assert.equal(inferProvider(undefined), 'unknown');
});

// --- parseAssistantMessage 测试 ---

test('标准 assistant 消息 → 正确提取所有字段', () => {
  const line = JSON.stringify({
    type: 'assistant',
    timestamp: '2024-01-01T00:00:00.000Z',
    message: {
      id: 'msg_01XyZ',
      model: 'claude-3-5-sonnet-20241022',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 20,
        cache_creation_input_tokens: 10,
      },
    },
  });

  const result = parseAssistantMessage(line);

  assert.equal(result.id, 'msg_01XyZ');
  assert.equal(result.model, 'claude-3-5-sonnet-20241022');
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.input_tokens, 100);
  assert.equal(result.output_tokens, 50);
  assert.equal(result.cache_read_tokens, 20);
  assert.equal(result.cache_write_tokens, 10);
  assert.equal(result.timestamp, '2024-01-01T00:00:00.000Z');
  assert.equal(result.source, 'log');
});

test('非 assistant 类型 → null', () => {
  const line = JSON.stringify({ type: 'user', message: {} });
  assert.equal(parseAssistantMessage(line), null);
});

test('assistant 但无 usage → null', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: { id: 'msg_abc', model: 'claude-3-5-sonnet' },
  });
  assert.equal(parseAssistantMessage(line), null);
});

test('assistant 无缓存字段 → cache tokens 默认为 0', () => {
  const line = JSON.stringify({
    type: 'assistant',
    message: {
      id: 'msg_xyz',
      model: 'gpt-4o',
      usage: {
        input_tokens: 80,
        output_tokens: 30,
      },
    },
  });

  const result = parseAssistantMessage(line);
  assert.equal(result.cache_read_tokens, 0);
  assert.equal(result.cache_write_tokens, 0);
});

test('无效 JSON → null', () => {
  assert.equal(parseAssistantMessage('{invalid json}'), null);
});

test('空字符串 → null', () => {
  assert.equal(parseAssistantMessage(''), null);
});

test('null 输入 → null', () => {
  assert.equal(parseAssistantMessage(null), null);
});
