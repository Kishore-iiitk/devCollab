export const calcProgress = (tasks = []) => {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
};
