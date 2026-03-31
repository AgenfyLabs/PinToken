// 费用计算引擎测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateCost, getBaselineModel } from '../src/pricing/calculator.mjs';

// 测试：Claude Sonnet 基础费用计算
test('claude sonnet: 1000 in / 500 out', () => {
  const result = calculateCost({
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    input_tokens: 1000,
    output_tokens: 500,
  });

  // input: 1000/1M * 3.00 = 0.003000
  // output: 500/1M * 15.00 = 0.007500
  // total: 0.010500
  assert.equal(result.cost_usd, 0.0105);

  // baseline opus: input 1000/1M * 15.00 + output 500/1M * 75.00
  // = 0.015000 + 0.037500 = 0.052500
  assert.equal(result.baseline_cost_usd, 0.0525);
  assert.equal(result.unknown, false);
});

// 测试：GPT-4o-mini 费用计算
test('gpt-4o-mini: 2000 in / 1000 out', () => {
  const result = calculateCost({
    provider: 'openai',
    model: 'gpt-4o-mini',
    input_tokens: 2000,
    output_tokens: 1000,
  });

  // input: 2000/1M * 0.15 = 0.000300
  // output: 1000/1M * 0.60 = 0.000600
  // total: 0.000900
  assert.equal(result.cost_usd, 0.0009);

  // baseline gpt-4o: input 2000/1M * 2.50 + output 1000/1M * 10.00
  // = 0.005000 + 0.010000 = 0.015000
  assert.equal(result.baseline_cost_usd, 0.015);
  assert.equal(result.unknown, false);
});

// 测试：带缓存的 Claude Sonnet 费用计算
test('claude sonnet with cache: 1000 in / 500 out / 5000 cache_read / 2000 cache_write', () => {
  const result = calculateCost({
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_tokens: 5000,
    cache_write_tokens: 2000,
  });

  // input: 1000/1M * 3.00 = 0.003000
  // output: 500/1M * 15.00 = 0.007500
  // cache_read: 5000/1M * 0.30 = 0.001500
  // cache_write: 2000/1M * 3.75 = 0.007500
  // total: 0.019500
  assert.equal(result.cost_usd, 0.0195);
});

// 测试：未知模型返回 unknown: true
test('unknown model returns cost 0 and unknown: true', () => {
  const result = calculateCost({
    provider: 'anthropic',
    model: 'claude-nonexistent-model',
    input_tokens: 1000,
    output_tokens: 500,
  });

  assert.equal(result.cost_usd, 0);
  assert.equal(result.baseline_cost_usd, 0);
  assert.equal(result.saved_usd, 0);
  assert.equal(result.unknown, true);
});

// 测试：getBaselineModel
test('getBaselineModel: anthropic → opus key', () => {
  assert.equal(getBaselineModel('anthropic'), 'anthropic/claude-opus-4-6');
});

test('getBaselineModel: openai → gpt-4o key', () => {
  assert.equal(getBaselineModel('openai'), 'openai/gpt-4o');
});

test('getBaselineModel: unknown → null', () => {
  assert.equal(getBaselineModel('unknown'), null);
});
