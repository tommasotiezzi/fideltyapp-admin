const { PKPass } = require("passkit-generator");
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { cardNumber } = req.query;
  
  if (!cardNumber) {
    return res.status(400).json({ error: 'Card number required' });
  }

  try {
    // Get card data from Supabase
    const { data: card, error } = await supabase
      .from('customer_cards')
      .select('*')
      .eq('card_number', parseInt(cardNumber))
      .single();
      
    if (error || !card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const pass = new PKPass({
      model: {
        formatVersion: 1,
        passTypeIdentifier: "pass.eu.loyaly.loyaly",
        serialNumber: String(card.card_number),
        teamIdentifier: "8U9RFQ4C56",
        organizationName: card.display_name,
        description: `${card.display_name} Loyalty Card`,
        foregroundColor: card.text_color || "#FFFFFF",
        backgroundColor: card.card_color || "#7c5ce6",
        labelColor: "#FFFFFF",  // Add this
        
        // Add the barcode properly
        barcodes: [{
          format: "PKBarcodeFormatQR",
          message: card.id,
          messageEncoding: "iso-8859-1"
        }],
        
        // IMPORTANT: Specify the pass type!
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
          }],
          auxiliaryFields: [{
            key: "location",
            label: "LOCATION",
            value: card.location_name
          }]
        }
      },
      certificates: {
        wwdr: Buffer.from(process.env.APPLE_WWDR_CERT, 'base64').toString('utf8'),
        signerCert: Buffer.from(process.env.APPLE_SIGNER_CERT, 'base64').toString('utf8'),
        signerKey: Buffer.from(process.env.APPLE_SIGNER_KEY, 'base64').toString('utf8')
      },
      // Add this to specify we're using raw certificates
      rawCertificates: true
    });

    const buffer = await pass.getAsBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', `attachment; filename=loyaly-${cardNumber}.pkpass`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Pass generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate pass', 
      details: error.message
    });
  }
}
