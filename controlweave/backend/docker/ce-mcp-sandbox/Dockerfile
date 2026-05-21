# CE-MCP Sandbox Container
# Secure, isolated environment for code execution
# Based on MAESTRO framework security requirements

FROM node:20-alpine3.21

# Security: Run as non-root user
RUN addgroup -S sandbox && adduser -S -G sandbox -u 10000 sandbox

# Install Python for multi-language support and upgrade OS packages
RUN apk update && apk upgrade --no-cache && apk add --no-cache python3 py3-pip

# Set working directory
WORKDIR /sandbox

# Create writable temp directory
RUN mkdir -p /tmp && chmod 1777 /tmp

# Switch to non-root user
USER sandbox

# Set environment
ENV NODE_ENV=production
ENV PYTHON_UNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version && python3 --version || exit 1

# Default command (will be overridden)
CMD ["node", "--version"]
