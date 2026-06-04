export async function parseJsonResponse<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.ok
        ? "서버 응답이 비어 있습니다."
        : `서버 오류가 발생했습니다. (${res.status}) 개발 서버를 재시작하거나 DB 설정(npx prisma db push)을 확인해 주세요.`
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("서버 응답을 처리할 수 없습니다. 개발 서버가 실행 중인지 확인해 주세요.");
  }
}
