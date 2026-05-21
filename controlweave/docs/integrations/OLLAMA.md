# 🦙 Ollama Integration Guide

Configure Ollama for private, offline AI inference in ControlWeave.

## Overview

Ollama lets you run large language models locally on your own hardware, providing fully private AI inference with no data leaving your environment. This is ideal for organizations with strict data sovereignty requirements.

**ControlWeave fully supports quantized GGUF models** — 4-bit and 5-bit quantized variants that use significantly less RAM and run faster than their full-precision counterparts, with minimal accuracy loss. This approach aligns with the same principles as Google Research's [TurboQuant](https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/) technique, which achieves up to 6× memory compression and 8× faster inference while preserving model accuracy.

## Prerequisites

- A machine with sufficient RAM (8GB+ for 7B models, 16GB+ for 13B models)
- Ollama installed on a server accessible to your ControlWeave backend
- For GPU acceleration: NVIDIA GPU with CUDA or Apple Silicon

## Installing Ollama

### Linux / macOS
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Download and run the installer from [ollama.com](https://ollama.com)

### Docker
```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

## Pulling a Model

After installing Ollama, download a compatible model:

```bash
# Recommended for ControlWeave (balance of quality and speed)
ollama pull llama3.1:8b

# Quantized variant — ~50% less RAM, similar quality (recommended for constrained hardware)
ollama pull llama3.1:8b-q4_K_M

# Smaller, faster option
ollama pull llama3.2:3b

# Quantized small model — runs on as little as 2GB RAM
ollama pull llama3.2:3b-q4_K_M

# Larger, higher quality (requires 16GB+ RAM)
ollama pull llama3.1:70b

# Quantized large model — 70B quality on ~24GB RAM
ollama pull llama3.1:70b-q4_K_M

# Alternative models (quantized)
ollama pull mistral:7b-q4_K_M
ollama pull qwen2.5:7b-q4_K_M
```

## Configuring Ollama in ControlWeave

1. Navigate to **Settings** → **LLM Configuration**
2. Select **Ollama** as your provider
3. Enter the Ollama server URL:
   - Local (same machine): `http://localhost:11434`
   - Remote server: `http://your-server-ip:11434`
4. Select your model from the dropdown (or type the model name)
5. Click **Test Connection** to verify connectivity
6. Click **Save**

## Network Configuration

If Ollama and ControlWeave backend are on different machines:

```bash
# Allow Ollama to listen on all interfaces (not just localhost)
OLLAMA_HOST=0.0.0.0 ollama serve
```

For Docker deployments:
```bash
docker run -d \
  -e OLLAMA_HOST=0.0.0.0 \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  ollama/ollama
```

## Recommended Models for GRC Use Cases

| Model | RAM Required | Best For |
|-------|-------------|----------|
| `llama3.1:8b` | 8GB | General GRC queries, fast responses |
| `llama3.1:8b-q4_K_M` | ~4.5GB | General GRC queries, constrained hardware |
| `llama3.1:8b-q5_K_M` | ~5.5GB | Better accuracy with moderate compression |
| `llama3.1:70b` | 40GB | Deep analysis, policy generation |
| `llama3.1:70b-q4_K_M` | ~24GB | Deep analysis on consumer GPUs |
| `mistral:7b` | 4.1GB | Quick queries, lightweight deployment |
| `mistral:7b-q4_K_M` | ~2.5GB | Quick queries, minimal hardware |
| `qwen2.5:14b` | 9GB | Strong reasoning, compliance analysis |
| `qwen2.5:14b-q4_K_M` | ~5GB | Strong reasoning on smaller servers |
| `phi3:mini-q4_K_M` | ~2GB | Ultra-lightweight, simple queries |
| `gemma2:9b-q4_K_M` | ~4GB | Balanced reasoning, small footprint |

## Quantized Models: TurboQuant-Style Efficiency

Quantized models (the `-qN_K_M` suffix variants) deliver dramatically better efficiency with minimal quality tradeoff — consistent with the extreme compression principles from Google Research's [TurboQuant](https://research.google/blog/turboquant-redefining-ai-efficiency-with-extreme-compression/) work.

### Understanding Quantization Levels

Ollama uses the **GGUF format** with multiple quantization levels:

| Quantization | Bits/Weight | Memory Savings | Accuracy |
|-------------|-------------|----------------|----------|
| `q4_K_M` | 4-bit | ~50% vs FP16 | Excellent for most GRC tasks |
| `q5_K_M` | 5-bit | ~37% vs FP16 | Higher accuracy, still compact |
| `q8_0` | 8-bit | ~25% vs FP16 | Near-lossless quality |
| (none / default) | 16-bit | baseline | Full quality |

**Recommendation for most ControlWeave deployments**: Use `q4_K_M` variants. They run on hardware that would otherwise be insufficient for the full-precision model (e.g., running a 70B-class model on a 24GB GPU instead of requiring 80GB+).

### How to Use Quantized Models in ControlWeave

1. Pull a quantized model:
   ```bash
   ollama pull llama3.1:8b-q4_K_M
   ```
2. In **Settings → LLM Configuration**, select **Ollama** as provider
3. Type the full model name (e.g., `llama3.1:8b-q4_K_M`) or select from the dropdown
4. Click **Test Connection** and then **Save**

### Why This Matters for GRC

- **Air-gapped / on-premise deployments**: Run a capable 70B-class model on a standard workstation instead of requiring enterprise GPU servers
- **Cost reduction**: Smaller RAM footprint means fewer/cheaper machines needed for self-hosted inference
- **Speed**: Quantized models process compliance analysis and gap detection faster due to reduced memory bandwidth
- **No accuracy penalty**: For policy Q&A, control gap analysis, and evidence summarization, 4-bit quantized models perform on par with full-precision equivalents

## Performance Tips

- For best performance, use GPU acceleration (NVIDIA or Apple Silicon)
- Keep the Ollama server close to your ControlWeave backend to minimize latency
- Monitor RAM usage — models use significant memory while loaded
- Enable model caching by keeping Ollama running between requests
- Prefer `q4_K_M` quantized models when RAM is limited — same quality, half the memory

## Troubleshooting

**Connection refused**: Ensure Ollama is running (`ollama serve`) and port 11434 is accessible  
**Model not found**: Pull the model first with `ollama pull <model-name>`  
**Slow responses**: Consider a smaller model, a quantized variant (`q4_K_M`), or enable GPU acceleration  
**Out of memory**: Use a quantized model (e.g., `llama3.1:70b-q4_K_M` instead of `llama3.1:70b`) or switch to a smaller size class

## Related Guides

- [AI Copilot](../guides/AI_COPILOT.md) - AI Copilot user guide
- [AI Analysis](../guides/AI_ANALYSIS.md) - AI analysis features
- [Settings & LLM Configuration](../guides/SETTINGS.md) - Configure AI providers
- [Model Quantization](../guides/MODEL_QUANTIZATION.md) - In-depth guide to quantized models
- [AI Usage Guidelines](../best-practices/AI_USAGE.md) - AI best practices
