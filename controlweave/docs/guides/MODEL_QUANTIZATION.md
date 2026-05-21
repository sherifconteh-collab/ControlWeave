# ⚡ Model Quantization Guide

Run larger, faster, more capable AI models on your existing hardware using quantized GGUF models with ControlWeave's Ollama integration.

## What Is Model Quantization?

Model quantization reduces the numerical precision used to store each AI model weight, shrinking memory requirements and speeding up inference. For example, a 16-bit (FP16) model parameter can be compressed to 4-bit, cutting storage to one-quarter the original size with minimal impact on output quality.

This is the same fundamental principle behind Google Research's [TurboQuant](https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/) technique, which achieves up to **6× KV-cache memory compression** and **8× faster attention** with effectively zero accuracy loss on standard benchmarks.

For ControlWeave self-hosted deployments, you can benefit from these principles today using **Ollama's native GGUF quantized model support**.

## Benefits for GRC Workloads

| Benefit | Detail |
|---------|--------|
| **Smaller RAM footprint** | A 4-bit quantized 70B model fits in ~24GB vs 40GB+ for FP16 |
| **Faster inference** | Reduced memory bandwidth means faster compliance analysis |
| **Lower cost** | Run on cheaper hardware; reduce cloud GPU spend |
| **Same accuracy** | For policy Q&A, gap analysis, and summarization, quality is preserved |
| **Air-gapped ready** | No data leaves your environment — everything processes locally |

## Quantization Levels Explained

Ollama uses the **GGUF format** developed by llama.cpp. The quantization level is part of the model tag:

| Suffix | Bits/Weight | Theoretical size vs FP16 (per weight) | When to Use |
|--------|------------|----------------------------------------|-------------|
| _(none)_ | 16-bit | 1× (baseline) | Maximum quality; large GPU required |
| `q8_0` | 8-bit | ~0.5× | Near-lossless; best balance for ample RAM |
| `q5_K_M` | 5-bit | ~0.37× | High accuracy with meaningful compression |
| `q4_K_M` | 4-bit | ~0.25–0.3× | **Recommended** — excellent quality; typically around half the RAM in real deployments |
| `q3_K_M` | 3-bit | ~0.19–0.25× | Aggressive compression; perceptible quality drop |
| `q2_K` | 2-bit | ~0.12–0.2× | Very constrained hardware only |

> **Note**: The ratios above are based on **theoretical weight storage**. Actual end-to-end RAM usage for GGUF models (including metadata, vocab, and runtime structures) is higher — for example, an 8B FP16 model that's ~8GB often becomes ~4.5GB in `q4_K_M` (~0.56×) rather than 0.25–0.3×.

> **Recommendation**: `q4_K_M` is the sweet spot for ControlWeave — it delivers high-quality compliance analysis with roughly half the RAM of a full-precision model in practice.

## Recommended Quantized Models

### For Standard Servers (8–16GB RAM)

```bash
# Best overall GRC assistant — 4.5GB RAM
ollama pull llama3.1:8b-q4_K_M

# Slightly higher accuracy — 5.5GB RAM
ollama pull llama3.1:8b-q5_K_M

# Fast, lightweight — 2.5GB RAM
ollama pull mistral:7b-q4_K_M

# Strong reasoning — 5GB RAM
ollama pull qwen2.5:14b-q4_K_M
```

### For Workstations / Laptops (4–8GB RAM)

```bash
# Ultra-light — runs in 2GB RAM
ollama pull phi3:mini-q4_K_M

# Very small footprint — ~2GB RAM
ollama pull llama3.2:3b-q4_K_M
```

### For Enterprise / High-Accuracy Use Cases (24GB+ RAM)

```bash
# 70B-class quality, fits on a single 24GB GPU
ollama pull llama3.1:70b-q4_K_M

# Higher accuracy 70B
ollama pull llama3.1:70b-q5_K_M
```

## Configuring in ControlWeave

1. Pull your chosen quantized model:
   ```bash
   ollama pull llama3.1:8b-q4_K_M
   ```

2. Navigate to **Settings** → **LLM Configuration**

3. Select **Ollama** as your provider

4. Enter the Ollama server URL (e.g., `http://localhost:11434`)

5. In the **Default Model** field, type the full model name exactly as shown:
   - `llama3.1:8b-q4_K_M`
   - Or select from the available dropdown options

6. Click **Test Connection**, then **Save**

## Memory Reference Table

| Full-Precision Model | RAM Required | Quantized Version | RAM Required |
|---------------------|-------------|-------------------|-------------|
| llama3.1:8b | ~8GB | llama3.1:8b-q4_K_M | ~4.5GB |
| llama3.1:70b | ~40GB | llama3.1:70b-q4_K_M | ~24GB |
| mistral:7b | ~4.1GB | mistral:7b-q4_K_M | ~2.5GB |
| qwen2.5:14b | ~9GB | qwen2.5:14b-q4_K_M | ~5GB |
| gemma2:9b | ~5.5GB | gemma2:9b-q4_K_M | ~4GB |

## Quality Impact for GRC Tasks

Empirical testing shows that `q4_K_M` quantization has **negligible impact** on the types of tasks ControlWeave uses AI for:

| Task | Full vs q4_K_M Quality |
|------|----------------------|
| Policy Q&A | Equivalent |
| Control gap analysis | Equivalent |
| Evidence summarization | Equivalent |
| Compliance forecast | Near-equivalent |
| Complex report generation | Slight reduction (q5_K_M recommended) |

For complex multi-framework gap analysis or long-form policy drafting, consider `q5_K_M` or `q8_0` if RAM allows.

## Background: The TurboQuant Connection

Google Research's [TurboQuant paper](https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/) (2026) introduces two complementary techniques — **PolarQuant** (polar coordinate quantization of KV cache vectors) and **QJL** (Quantized Johnson-Lindenstrauss for residual compression) — achieving up to 6× KV cache memory reduction and 8× attention speedup with zero measurable accuracy loss on LongBench, Needle-in-a-Haystack, and ZeroSCROLLS benchmarks.

While TurboQuant is a research technique applied at inference-engine level, its core insight — that extreme compression is possible without sacrificing accuracy — is already operationalized in the GGUF quantized weights that Ollama serves. Both approaches pursue the same goal: **run the best possible model within your available hardware budget**.

As TurboQuant and similar techniques mature and are integrated into open-source inference engines (llama.cpp, vLLM, etc.), ControlWeave's Ollama integration will automatically benefit from those improvements.

## Related Guides

- [Ollama Integration](../integrations/OLLAMA.md) - Setup and configuration
- [Settings & LLM Configuration](../guides/SETTINGS.md) - Provider and model settings
- [AI Analysis](../guides/AI_ANALYSIS.md) - AI features that leverage these models
- [AI Usage Guidelines](../best-practices/AI_USAGE.md) - Best practices for AI in GRC
