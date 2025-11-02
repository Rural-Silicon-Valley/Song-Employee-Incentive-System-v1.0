interface EvaluationResult {
  score: number;
  feedback: string;
  status: "APPROVED" | "REJECTED";
}

const positiveKeywords = ["落实", "创新", "协同", "效率", "客户", "成果", "迭代", "指标", "方案", "执行"];

export function evaluateSubmission(content: string): EvaluationResult {
  const lengthScore = Math.min(100, Math.round((content.length / 500) * 100));
  const keywordMatches = positiveKeywords.reduce((count, keyword) => {
    return count + (content.includes(keyword) ? 1 : 0);
  }, 0);

  const keywordScore = Math.min(30, keywordMatches * 6);
  const overallScore = Math.round(0.7 * lengthScore + 0.3 * keywordScore);

  const finalScore = Math.max(40, Math.min(100, overallScore));

  const feedbackParts: string[] = ["AI测评结果："];
  if (finalScore >= 85) {
    feedbackParts.push("内容详实且聚焦关键成果，保持优秀表现！");
  } else if (finalScore >= 70) {
    feedbackParts.push("内容较为完整，可进一步补充量化指标与落地细节。");
  } else {
    feedbackParts.push("建议补充任务目标、执行过程与结果，完善提交内容。");
  }

  if (keywordMatches === 0) {
    feedbackParts.push("可尝试结合业务关键词描述亮点。");
  }

  const status: "APPROVED" | "REJECTED" = finalScore >= 60 ? "APPROVED" : "REJECTED";

  return {
    score: finalScore,
    feedback: feedbackParts.join("\n"),
    status,
  };
}
