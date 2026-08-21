import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cart, CartLine, Product } from "@/domain/types";
import { clampQuantity, itemsSubtotal, MAX_LINE_QUANTITY } from "./pricing";
import { useRouterState } from "@tanstack/react-router";
import { getAnonymousSessionId, readJson, writeJson } from "./session";

const CART_KEY = "tikka.cart";

/** كل سوبرماركت له سلة منفصلة تمامًا — مفيش خلط بين متجر وآخر. */
function cartKeyFor(pathname: string): string {
  const match = /^\/s\/([^/]+)/u.exec(pathname);
  return match ? `store.cart:${match[1]}` : CART_KEY;
}

type CartContextValue = {
  cart: Cart;
  ready: boolean;
  count: number;
  subtotal: number;
  addProduct: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  restoreLine: (line: CartLine) => void;
  setNote: (productId: string, note: string) => void;
  clear: () => void;
  quantityOf: (productId: string) => number;
};

const emptyCart: Cart = { sessionId: "ssr", lines: [], updatedAt: new Date(0).toISOString() };

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [ready, setReady] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const storageKey = cartKeyFor(pathname);

  useEffect(() => {
    setReady(false);
    const sessionId = getAnonymousSessionId();
    const stored = readJson<Cart | null>(storageKey, null);
    setCart(
      stored?.lines
        ? { ...stored, sessionId }
        : { sessionId, lines: [], updatedAt: new Date().toISOString() },
    );
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (ready) writeJson(storageKey, cart);
  }, [cart, ready, storageKey]);

  const update = useCallback((mutate: (lines: CartLine[]) => CartLine[]) => {
    setCart((current) => ({
      ...current,
      lines: mutate(current.lines),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addProduct = useCallback(
    (product: Product, quantity = 1) => {
      if (!product.available || product.stock <= 0) return;
      update((lines) => {
        const existing = lines.find((line) => line.productId === product.id);
        const max = Math.min(product.stock, MAX_LINE_QUANTITY);
        if (existing) {
          return lines.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: clampQuantity(line.quantity + quantity, max) }
              : line,
          );
        }
        const newLine: CartLine = {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          size: product.size,
          unit: product.unit,
          unitPrice: product.price,
          compareAtPrice: product.compareAtPrice ?? null,
          image: product.images[0],
          quantity: clampQuantity(quantity, max),
          maxQuantity: max,
        };
        return [...lines, newLine];
      });
    },
    [update],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      update((lines) =>
        lines
          .map((line) =>
            line.productId === productId
              ? { ...line, quantity: clampQuantity(quantity, line.maxQuantity) }
              : line,
          )
          .filter((line) => (line.productId === productId ? quantity > 0 : true)),
      );
    },
    [update],
  );

  const removeLine = useCallback(
    (productId: string) => update((lines) => lines.filter((line) => line.productId !== productId)),
    [update],
  );

  const restoreLine = useCallback(
    (line: CartLine) =>
      update((lines) => (lines.some((l) => l.productId === line.productId) ? lines : [...lines, line])),
    [update],
  );

  const setNote = useCallback(
    (productId: string, note: string) =>
      update((lines) => lines.map((line) => (line.productId === productId ? { ...line, note } : line))),
    [update],
  );

  const clear = useCallback(() => update(() => []), [update]);

  const value = useMemo<CartContextValue>(() => {
    const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    return {
      cart,
      ready,
      count,
      subtotal: itemsSubtotal(cart.lines),
      addProduct,
      setQuantity,
      removeLine,
      restoreLine,
      setNote,
      clear,
      quantityOf: (productId: string) =>
        cart.lines.find((line) => line.productId === productId)?.quantity ?? 0,
    };
  }, [cart, ready, addProduct, setQuantity, removeLine, restoreLine, setNote, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart لازم يتستخدم جوه CartProvider");
  return context;
}
