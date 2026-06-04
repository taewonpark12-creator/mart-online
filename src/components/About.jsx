import { STORE } from '../data/store';

export default function About() {
  const infos = [
    {
      icon: '📍',
      title: '위치',
      lines: [STORE.address, STORE.addressDetail],
    },
    {
      icon: '📞',
      title: '연락처',
      lines: [`${STORE.phone} / ${STORE.phoneMobile}`, '문의는 전화로 주세요'],
    },
    {
      icon: '🕐',
      title: '영업시간',
      lines: [STORE.hours, '매일 동일 시간'],
    },
  ];

  return (
    <>
      <section id="about" className="section about-section">
        <div className="container">
          <p className="section-eyebrow">Visit Us</p>
          <h2 className="section-title">마트 정보</h2>
          <div className="about-cards">
            {infos.map((info) => (
              <article key={info.title} className="about-card">
                <span className="about-icon">{info.icon}</span>
                <h3>{info.title}</h3>
                {info.lines.map((line, i) => (
                  <p key={i} className={i === 0 ? 'primary-line' : ''}>
                    {line}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-banner">
        <div className="container cta-inner">
          <h2>지금 바로 주문해보세요</h2>
          <p>신선한 상품을 편리하게 주문하고, 픽업 또는 배달로 받아보세요.</p>
          <button
            type="button"
            className="btn btn-gold"
            onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}
          >
            주문 시작하기 →
          </button>
        </div>
      </section>
    </>
  );
}
