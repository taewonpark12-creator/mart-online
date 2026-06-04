import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import About from './components/About';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import OrderModal from './components/OrderModal';

export default function App() {
  return (
    <CartProvider>
      <Header />
      <main>
        <Hero />
        <ProductGrid />
        <About />
      </main>
      <Footer />
      <CartDrawer />
      <OrderModal />
    </CartProvider>
  );
}
