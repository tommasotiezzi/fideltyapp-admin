const { PKPass } = require("passkit-generator");
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Create a simple 1x1 pixel transparent PNG as placeholder
const createPlaceholderIcon = () => {
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
};

module.exports = async (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({ error: 'Card ID required' });
  }

  try {
    const { data: card, error } = await supabase
      .from('customer_cards')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const passJson = {
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
        message: card.id,
        messageEncoding: "iso-8859-1"
      }],
      
      storeCard: {
        headerFields: [{
          key: "cardNumber",
          label: "CARD",
          value: `#${card.card_number}`
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
    };

    // Create pass with icon files
    const pass = new PKPass(
      {
        "pass.json": Buffer.from(JSON.stringify(passJson)),
        "icon.png": createPlaceholderIcon(),
        "icon@2x.png": createPlaceholderIcon(),
        "icon@3x.png": createPlaceholderIcon()
      },
      {
        wwdr: Buffer.from(process.env.APPLE_WWDR_CERT, 'base64').toString(),
        signerCert: Buffer.from(process.env.APPLE_SIGNER_CERT, 'base64').toString(),
        signerKey: Buffer.from(process.env.APPLE_SIGNER_KEY, 'base64').toString()
      }
    );

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

