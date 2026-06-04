import { STORE, FEATURES, CATEGORIES } from '../data/store';

export default function Hero() {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <section id="hero" className="hero">
        <div className="hero-inner">
          <p className="hero-tag">
            <span>🌿</span> {STORE.tagline}
          </p>
          <h1 className="hero-title">
            {STORE.name}에서
            <br />
            <em>신선한 식재료</em>를
            <br />
            주문하세요
          </h1>
          <p className="hero-desc">{STORE.description}</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-gold" onClick={() => scrollTo('shop')}>
              상품 보러가기 →
            </button>
            <a href={`tel:${STORE.phone.replace(/-/g, '')}`} className="btn btn-ghost-hero">
              전화 문의
            </a>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container features-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="categories" className="section categories-section">
        <div className="container">
          <p className="section-eyebrow">Categories</p>
          <h2 className="section-title">카테고리별 상품</h2>
          <div className="category-grid">
            {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="category-card"
                onClick={() => {
                  scrollTo('shop');
                  window.dispatchEvent(
                    new CustomEvent('select-category', { detail: cat.id })
                  );
                }}
              >
                <span className="category-emoji">{cat.emoji}</span>
                <strong>{cat.label}</strong>
                <span>{cat.desc}</span>
              </button>
            ))}
          </div>
          <div className="section-cta">
            <button type="button" className="btn btn-outline" onClick={() => scrollTo('shop')}>
              전체 상품 보기 →
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
