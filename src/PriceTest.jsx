import { useState, useEffect } from 'react';

function PriceTest() {
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch('https://impure-freewill-blazing.ngrok-free.dev/api/price?barcode=000000020008');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setProductData(data);
        setLoading(false);
      } catch (err) {
        console.error('API 호출 오류:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchPrice();
  }, []);

  if (loading) {
    return <div>로딩 중...</div>;
  }

  if (error) {
    return <div>오류 발생: {error}</div>;
  }

  return (
    <div>
      <h2>가격 테스트</h2>
      {productData ? (
        <div>
          <p>상품명: {productData.name || 'N/A'}</p>
          <p>가격: {productData.price || 'N/A'}</p>
        </div>
      ) : (
        <p>데이터가 없습니다.</p>
      )}
    </div>
  );
}

export default PriceTest;
