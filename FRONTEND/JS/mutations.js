// js/mutations.js

/**
 * Handle checking out an item safely via Supabase RPC
 */
async function processCheckout(itemId, checkoutAmount, requesterName, project) {
  const item = localInventoryCache.find(i => i.id === itemId);
  if (!item || item.amount < checkoutAmount) {
    alert('Insufficient stock!');
    return;
  }

  try {
    // Atomic stock decrement via DB-side RPC
    const { error: updateError } = await sbClient
      .rpc('decrement_stock', {
        item_id: itemId,
        check_amount: checkoutAmount
      });

    if (updateError) throw updateError;

    // Log transaction
    const { error: insertError } = await sbClient
      .from('transactions')
      .insert([{
        item_id: itemId,
        transaction_type: 'checkout',
        amount: checkoutAmount,
        requester: requesterName,
        project: project,
        timestamp: new Date().toISOString()
      }]);

    if (insertError) throw insertError;

    // Optimistically update local cache & DOM
    item.amount -= checkoutAmount;
    const row = document.querySelector(`tr[data-id="${itemId}"]`);
    if (row) row.cells[6].textContent = `${item.amount} pcs`;

    alert('Checkout successful!');
    window.location.hash = '';

  } catch (error) {
    console.error('Transaction Failed:', error.message);
    alert('Checkout failed. Please try again.');
  }
}
