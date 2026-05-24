import React, { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { showAlert } from "../../utils/alerts";
import PaymentUpload from "./PaymentUpload";

export default function RegisterPaymentSection() {
  const [paymentMethod, setPaymentMethod] = useState("binance_pay");
  const [paymentReference, setPaymentReference] = useState("");
  const [euroRate, setEuroRate] = useState<number | null>(null);
  const [vesAmount, setVesAmount] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const res = await fetch("https://ve.dolarapi.com/v1/euros/oficial");
        const data = await res.json();
        if (data && data.promedio) {
          setEuroRate(data.promedio);
          setVesAmount(30 * data.promedio);
        }
      } catch (e) {
        console.error("Error fetching euro rate:", e);
      }
    };
    fetchRate();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showAlert.success("Copiado", "El dato ha sido copiado al portapapeles");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Selector de Método de Pago */}
      <div className="space-y-3 pt-6 border-t border-wc-border/40">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sports">
          Método de Pago
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label
            className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border ${paymentMethod === "binance_pay" ? "border-wc-gold bg-wc-gold/10" : "border-wc-border bg-wc-dark hover:border-slate-600"} transition-all`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="binance_pay"
              checked={paymentMethod === "binance_pay"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="hidden"
            />
            <span
              className={`text-xs font-bold font-sports uppercase tracking-wider ${paymentMethod === "binance_pay" ? "text-wc-gold" : "text-slate-400"}`}
            >
              Binance Pay
            </span>
          </label>
          <label
            className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border ${paymentMethod === "pago_movil" ? "border-wc-gold bg-wc-gold/10" : "border-wc-border bg-wc-dark hover:border-slate-600"} transition-all`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="pago_movil"
              checked={paymentMethod === "pago_movil"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="hidden"
            />
            <span
              className={`text-xs font-bold font-sports uppercase tracking-wider ${paymentMethod === "pago_movil" ? "text-wc-gold" : "text-slate-400"}`}
            >
              Pago Móvil (Bs)
            </span>
          </label>
          <label
            className={`cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border ${paymentMethod === "transferencia_bs" ? "border-wc-gold bg-wc-gold/10" : "border-wc-border bg-wc-dark hover:border-slate-600"} transition-all`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="transferencia_bs"
              checked={paymentMethod === "transferencia_bs"}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="hidden"
            />
            <span
              className={`text-xs font-bold font-sports uppercase tracking-wider ${paymentMethod === "transferencia_bs" ? "text-wc-gold" : "text-slate-400"}`}
            >
              Transferencia (Bs)
            </span>
          </label>
        </div>
      </div>

      {/* Datos de Pago e Instrucciones */}
      <div className="p-4 rounded-xl bg-wc-dark/60 border border-wc-border space-y-3 text-slate-300 mt-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5 font-sports">
          <span className="w-2 h-2 rounded-full bg-wc-gold animate-pulse"></span>
          Instrucciones de Pago
        </h4>

        {paymentMethod === "binance_pay" && (
          <>
            <p className="text-xs text-slate-400 leading-relaxed">
              Realiza una transferencia de exactamente{" "}
              <strong className="text-wc-gold">20.00 USDT</strong> a la
              siguiente cuenta de Binance Pay:
            </p>
            <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs font-mono space-y-1.5 text-slate-200">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                <span className="text-slate-400">Binance Pay ID:</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold select-all">139030711</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard("139030711", "binance_id")}
                    className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                    title="Copiar"
                  >
                    {copiedId === "binance_id" ? (
                      <Check className="w-3.5 h-3.5 text-wc-green" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                <span className="text-slate-400">Nombre de la Cuenta:</span>
                <span className="font-bold">Alirio Isea</span>
              </div>
            </div>
          </>
        )}

        {(paymentMethod === "pago_movil" ||
          paymentMethod === "transferencia_bs") && (
          <div className="space-y-3">
            <div className="p-3 bg-wc-gold/10 border border-wc-gold/20 rounded-lg text-xs md:text-sm text-wc-gold font-medium leading-relaxed">
              <span className="font-bold">Aviso:</span> Si el pago es en
              Bolívares, el costo del cupo es de <strong>30 USD</strong>{" "}
              calculados a la tasa del Euro oficial (BCV) del día del pago. Ese
              dinero luego se cambiará a USDT y se aplicará la misma
              distribución de 15 USDT al pote y 5 USDT a gastos operativos.
            </div>

            {euroRate && vesAmount ? (
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                Tasa Euro BCV actual:{" "}
                <strong className="text-slate-200">
                  {formatCurrency(euroRate)} Bs
                </strong>
                <br />
                Monto total a transferir:{" "}
                <strong className="text-wc-gold text-base">
                  {formatCurrency(vesAmount)} Bs
                </strong>
              </p>
            ) : (
              <p className="text-xs text-slate-500 animate-pulse">
                Consultando tasa del Euro BCV actual...
              </p>
            )}

            {paymentMethod === "pago_movil" && (
              <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs font-mono space-y-2 text-slate-200">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                  <span className="text-slate-400">Banco:</span>
                  <span className="font-bold">Banco de Venezuela (0102)</span>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                  <span className="text-slate-400">CI:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold select-all">V23719075</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("V23719075", "pm_ci")}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                      title="Copiar"
                    >
                      {copiedId === "pm_ci" ? (
                        <Check className="w-3.5 h-3.5 text-wc-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                  <span className="text-slate-400">Teléfono:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold select-all">04147535965</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard("04147535965", "pm_tlf")}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                      title="Copiar"
                    >
                      {copiedId === "pm_tlf" ? (
                        <Check className="w-3.5 h-3.5 text-wc-green" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "transferencia_bs" && (
              <div className="space-y-3">
                <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs font-mono space-y-1.5 text-slate-200">
                  <p className="font-bold text-wc-gold mb-2">
                    A) Banco de Venezuela
                  </p>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                    <span className="text-slate-400">Cuenta:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold select-all">
                        01020441170000346696
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard("01020441170000346696", "tb_cuenta_1")
                        }
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                        title="Copiar"
                      >
                        {copiedId === "tb_cuenta_1" ? (
                          <Check className="w-3.5 h-3.5 text-wc-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                    <span className="text-slate-400">CI:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold select-all">V23719075</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("V23719075", "tb_ci_1")}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                        title="Copiar"
                      >
                        {copiedId === "tb_ci_1" ? (
                          <Check className="w-3.5 h-3.5 text-wc-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                    <span className="text-slate-400">Nombre:</span>
                    <span className="font-bold">
                      Alirio Salvador Isea Moreno
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-wc-card rounded-lg border border-wc-border/60 text-xs font-mono space-y-1.5 text-slate-200">
                  <p className="font-bold text-wc-gold mb-2">B) Banesco</p>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                    <span className="text-slate-400">Cuenta (Corriente):</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold select-all">
                        01340244272441045080
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard("01340244272441045080", "tb_cuenta_2")
                        }
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                        title="Copiar"
                      >
                        {copiedId === "tb_cuenta_2" ? (
                          <Check className="w-3.5 h-3.5 text-wc-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                    <span className="text-slate-400">CI:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold select-all">V23719075</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("V23719075", "tb_ci_2")}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-wc-gold transition-colors"
                        title="Copiar"
                      >
                        {copiedId === "tb_ci_2" ? (
                          <Check className="w-3.5 h-3.5 text-wc-green" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                    <span className="text-slate-400">Nombre:</span>
                    <span className="font-bold">
                      Alirio Salvador Isea Moreno
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-wc-red font-semibold leading-relaxed mt-2 p-2 bg-wc-red/10 border border-wc-red/20 rounded-lg">
          * IMPORTANTE: No incluyas palabras como "apuesta", "quiniela",
          "sorteo" ni referencias a juegos de azar en la nota de transferencia
          para evitar el bloqueo de las cuentas.
        </p>
      </div>

      <div className="mt-6">
        <label
          htmlFor="paymentReference"
          className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 font-sports"
        >
          Referencia del Pago
        </label>
        <input
          id="paymentReference"
          name="paymentReference"
          type="text"
          value={paymentReference}
          onChange={(e) => setPaymentReference(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-wc-dark border border-wc-border text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-wc-gold/50 focus:border-wc-gold transition-all duration-200 text-sm font-medium"
          placeholder={
            paymentMethod === "binance_pay"
              ? "Ej: alias.pay@gmail.com o ID 12345678"
              : "Ej: Ref: 123456 o Teléfono asociado"
          }
        />
        <p className="text-xs text-slate-500 mt-1.5">
          El comprobante de la transacción de pago.
        </p>
      </div>

      <div className="mt-6">
        <PaymentUpload
          initialLabel={
            paymentMethod === "binance_pay"
              ? "Sube tu comprobante de 20 USDT"
              : vesAmount
                ? `Sube tu comprobante de ${formatCurrency(vesAmount)} VES`
                : "Sube tu comprobante de pago"
          }
        />
      </div>
    </div>
  );
}
