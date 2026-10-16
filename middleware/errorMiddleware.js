export const notFound = (req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (error, req, res, next) => {
  console.error("API error:", error.message);

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      message: "Invalid JSON body"
    });
  }

  if (error.code === "23505") {
    return res.status(409).json({
      message: "A record with this information already exists"
    });
  }

  if (error.code === "23503") {
    return res.status(400).json({
      message: "Related record does not exist or is still in use"
    });
  }

  if (error.code === "23514" || error.code === "22P02") {
    return res.status(400).json({
      message: "Invalid value provided"
    });
  }

  res.status(500).json({
    message: "Internal server error"
  });
};