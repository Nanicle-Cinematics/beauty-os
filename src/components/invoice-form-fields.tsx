"use client";

import { useId, useState } from "react";

type AppointmentOption = {
  id: string;
  label: string;
  customerName: string;
  service: string;
  price: number;
  dueDate: string;
};

type InvoiceFormFieldsProps = {
  customers: string[];
  appointments: AppointmentOption[];
  currencySymbol: string;
};

function uniqueOptions(options: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const option of options) {
    const key = option.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      unique.push(option);
    }
  }
  return unique;
}

function moneyInputValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function InvoiceFormFields({ customers, appointments, currencySymbol }: InvoiceFormFieldsProps) {
  const customerListId = useId();
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [dueDate, setDueDate] = useState("");

  function applyAppointment(appointmentId: string) {
    const appointment = appointments.find((item) => item.id === appointmentId);
    if (!appointment) return;
    setCustomer(appointment.customerName);
    setDescription(appointment.service);
    setUnitPrice(moneyInputValue(appointment.price));
    setDueDate(appointment.dueDate);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          Due date
          <input name="dueDate" type="date" className="input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="field-label">
          Appointment
          <select name="appointmentId" className="input" onChange={(event) => applyAppointment(event.target.value)} defaultValue="">
            <option value="">Manual invoice</option>
            {appointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>{appointment.label}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="field-label">
        Client
        <input
          name="customer"
          list={customerListId}
          value={customer}
          onChange={(event) => setCustomer(event.target.value)}
          className="input"
          placeholder="Search or type a client..."
        />
        <datalist id={customerListId}>
          {uniqueOptions(customers).map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>

      <div className="border-t border-line-2 pt-5">
        <h2 className="text-[15px] font-semibold">Line item</h2>
        <div className="mt-3 grid gap-4">
          <label className="field-label">
            Description
            <input
              name="description"
              className="input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Soft glam bridal trial"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="field-label">
              Qty
              <input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" className="input" required />
            </label>
            <label className="field-label">
              Unit price ({currencySymbol})
              <input
                name="unitPrice"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Discount ({currencySymbol})
              <input name="discount" type="number" min="0" step="0.01" defaultValue="0" className="input" />
            </label>
            <label className="field-label">
              Tax ({currencySymbol})
              <input name="tax" type="number" min="0" step="0.01" defaultValue="0" className="input" />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
