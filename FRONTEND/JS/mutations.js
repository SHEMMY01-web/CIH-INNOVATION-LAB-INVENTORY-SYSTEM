// js/mutations.js

/**
 * Handle checking out an item safely via RPC
 */
async function processCheckout(itemId, checkoutAmount, requesterName, project) {
  // 1. Initial quick client-side check
  const item = localInventoryCache.find(i => i.id === itemId);
  if (!item || item.amount < checkoutAmount) {
    alert('Insufficient stock locally!');
    return;
  }

  try {
    // 2. Safe, atomic stock decrement via Supabase RPC
    const { error: updateError } = await supabase
      .rpc('decrement_stock', { 
        item_id: itemId, 
        check_amount: checkoutAmount 
      });

    if (updateError) throw updateError;

    // 3. Insert into Transactions table for historical tracking
    const { error: insertError } = await supabase
      .from('transactions')
      .insert([
        {
          item_id: itemId,
          transaction_type: 'checkout',
          amount: checkoutAmount,
          requester: requesterName,
          project: project,
          timestamp: new Date().toISOString()
        }
      ]);

    if (insertError) throw insertError;

    // 4. Optimistically update local cache and UI
    item.amount = item.amount - checkoutAmount;
    
    const row = document.querySelector(`tr[data-id="${itemId}"]`);
    if (row) {
      // Assuming amount is the 7th cell (index 6)
      row.cells[6].textContent = `${item.amount} pcs`; 
    }

    alert('Checkout successful!');
    window.location.hash = ''; // Close modal

  } catch (error) {
    console.error('Transaction Failed:', error.message);
    alert('Checkout failed. Please ensure there is enough stock.');
  }
}
