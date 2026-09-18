function extractCode(content) {
  const text = String(content || "").trim();

  const match = text.match(
    /\b(?:locketgold15s|canvapro|gemini5tb|netflixuhd|damefacebook|dameinstagram|dametiktok|tutbaogiamgiashopee|tutruaip|tutmanguonblackmmo|tooldamefacebook|unlockfacebook282)-[A-Z0-9]{6}\b/i
  );

  return match ? match[0] : null;
}
