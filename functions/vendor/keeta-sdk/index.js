class PlaceholderKeetaClient {
  constructor(config = {}) {
    this.config = { ...config };
    Object.defineProperty(this, "__isKeetaPlaceholder", {
      value: true,
      enumerable: false,
      configurable: false,
    });
  }

  async swap() {
    throw new Error(
      "@keeta/sdk is not available in this environment. Install the private Keeta SDK to enable real swaps."
    );
  }
}

module.exports = {
  KeetaClient: PlaceholderKeetaClient,
  default: PlaceholderKeetaClient,
  __isKeetaPlaceholder: true,
};
