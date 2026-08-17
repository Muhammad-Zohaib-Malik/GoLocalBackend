const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};

const convertDurationToDays = (durationStr) => {
  console.log(durationStr, "durationStr");
  if (!durationStr) {
    return null;
  }
  const match = durationStr.match(/(\d+(\.\d+)?)\s*month/);
  if (match) {
    const durationValue = parseFloat(match[1]);
    return durationValue * 30; // Convert months to days (approximate)
  }
  return null;
};
module.exports = { asyncHandler, convertDurationToDays };
