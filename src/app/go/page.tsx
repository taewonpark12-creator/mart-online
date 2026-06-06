"use client";

const TARGET_URL = "https://lovemart.vercel.app/";

export default function GoPage() {
  const handleRedirect = () => {
    window.open(TARGET_URL, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        {/* 제목 */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          더 나은 환경에서 이용해주세요
        </h1>

        {/* 설명 */}
        <p className="text-lg text-gray-600 mb-8">
          Safari 또는 Chrome 브라우저에서 더 안정적으로 이용할 수 있습니다
        </p>

        {/* 브라우저로 열기 버튼 */}
        <button
          onClick={handleRedirect}
          className="w-full bg-green-600 hover:bg-green-700 text-white text-xl font-bold py-5 px-6 rounded-xl transition-colors shadow-md active:scale-95"
        >
          브라우저로 열기
        </button>
      </div>
    </div>
  );
}
