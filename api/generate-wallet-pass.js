const { PKPass } = require("passkit-generator");
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  const { id } = req.query; // Using UUID for security in URL
  
  if (!id) {
    return res.status(400).json({ error: 'Card ID required' });
  }

  try {
    // Get card data using UUID
    const { data: card, error } = await supabase
      .from('customer_cards')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    // Create pass using PKPass.from with model object
    const pass = await PKPass.from({
      model: {
        "pass.json": Buffer.from(JSON.stringify({
          formatVersion: 1,
          passTypeIdentifier: "pass.eu.loyaly.loyaly",
          serialNumber: String(card.card_number),
          teamIdentifier: "8U9RFQ4C56",
          organizationName: card.display_name,
          description: `${card.display_name} Loyalty Card`,
          foregroundColor: card.text_color || "#FFFFFF",
          backgroundColor: card.card_color || "#7c5ce6",
          
          barcodes: [{
            format: "PKBarcodeFormatQR",
            message: card.id,  // UUID - matches your Flutter scanner!
            messageEncoding: "iso-8859-1"
          }],
          
          storeCard: {
            headerFields: [{
              key: "cardNumber",
              label: "CARD",
              value: `#${card.card_number}`  // Shows "#107" visually
            }],
            primaryFields: [{
              key: "stamps",
              label: "STAMPS",
              value: `${card.current_stamps}/${card.stamps_required}`
            }],
            secondaryFields: [{
              key: "reward",
              label: "REWARD",
              value: card.reward_text
            }]
          }
        }))
      },
      certificates: {
        wwdr: Buffer.from(process.env.APPLE_WWDR_CERT, 'base64'),
        signerCert: Buffer.from(process.env.APPLE_SIGNER_CERT, 'base64'),
        signerKey: Buffer.from(process.env.APPLE_SIGNER_KEY, 'base64')
      }
    });

    const buffer = pass.getAsBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `inline; filename="loyaly-${card.card_number}.pkpass"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Pass generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate pass', 
      details: error.message
    });
  }
};
