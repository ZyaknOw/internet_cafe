src/server.ts:933:90 - error TS18048: 'input.error' is possibly 'undefined'.

933   if (!input.success) return res.status(400).json({ error: "Invalid café order", fields: input.error.flatten() });
                                                                                             ~~~~~~~~~~~

src/server.ts:938:17 - error TS18048: 'value' is possibly 'undefined'.

938   const items = value.items.map((item) => ({ id: item.id, name: item.name, price: Number(item.price), quantity: item.quantity }));
                    ~~~~~

src/server.ts:952:27 - error TS18047: 'customer' is possibly 'null'.

952   const customerName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer";
                              ~~~~~~~~

src/server.ts:952:56 - error TS18047: 'customer' is possibly 'null'.

952   const customerName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer";
                                                           ~~~~~~~~

src/server.ts:956:28 - error TS18047: 'customer' is possibly 'null'.

956       customer_profile_id: customer.id,
                               ~~~~~~~~

src/server.ts:958:20 - error TS18048: 'value' is possibly 'undefined'.

958       station_key: value.stationKey ?? null,
                       ~~~~~

src/server.ts:964:14 - error TS18048: 'value' is possibly 'undefined'.

964       notes: value.notes ?? null,
                 ~~~~~

src/server.ts:970:45 - error TS18047: 'orderError' is possibly 'null'.

970     return res.status(status).json({ error: orderError.message });
                                                ~~~~~~~~~~

src/server.ts:973:26 - error TS18047: 'customer' is possibly 'null'.

973   const balance = Number(customer.balance || 0);
                             ~~~~~~~~


Found 9 errors in the same file, starting at: src/server.ts:933