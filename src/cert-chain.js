import { decode } from 'base64-arraybuffer'
import { fromBER } from 'asn1js'
import { Certificate, CertificateChainValidationEngine } from 'pkijs'

export function certFromPem(pem) {
  if (typeof pem !== 'string') {
    throw new Error('Expected PEM as string');
  }
  // Load certificate in PEM encoding (base64 encoded DER)
  const b64 = pem.replace(/(-----(BEGIN|END) CERTIFICATE-----|[\n\r\s])/g, '');
  // Now that we have decoded the cert it's now in DER-encoding
  // And massage the cert into a BER encoded one
  const ber = decode(b64);
  // And now Asn1js can decode things \o/
  const asn1 = fromBER(ber);
  return new Certificate({ schema: asn1.result });
}

export function validateCertChain({ trustedCerts = [], certs = [] }){
  const certChainVerificationEngine = new CertificateChainValidationEngine({
    trustedCerts
    , certs
  })

  return certChainVerificationEngine.verify() // throws
}
