/**
 * Natural language explanation utility for NIDS SHAP feature importance values.
 */

export interface FeatureExplanation {
  featureName: string;
  shapValue: number;
  explanation: string;
  impactPercentage: number;
}

export function getNaturalLanguageExplanation(featureName: string): string {
  const fLower = featureName.toLowerCase();

  if (fLower.includes('pkt') && (fLower.includes('rate') || fLower.includes('/s') || fLower.includes('speed'))) {
    return 'High packet transmission rate contributed significantly to this prediction.';
  }
  if (fLower.includes('pkt') || fLower.includes('packet')) {
    if (fLower.includes('std') || fLower.includes('len') || fLower.includes('size') || fLower.includes('var')) {
      return 'Unusual packet length distribution contributed to the prediction.';
    }
  }
  if (fLower.includes('duration') || fLower.includes('time')) {
    return 'Extended flow connection duration contributed to anomaly scoring.';
  }
  if (fLower.includes('syn') || fLower.includes('flag') || fLower.includes('ack') || fLower.includes('fin')) {
    return 'Abnormal TCP flag activity (SYN/ACK scan pattern) influenced model classification.';
  }
  if (fLower.includes('port')) {
    return 'Access to non-standard or sensitive service port contributed to the alert.';
  }
  if (fLower.includes('header') || fLower.includes('hdr')) {
    return 'Anomalous IP/TCP protocol header lengths contributed to the classification.';
  }
  if (fLower.includes('subflow') || fLower.includes('fwd') || fLower.includes('bwd')) {
    return 'Unbalanced forward/backward network traffic flow ratio influenced the model decision.';
  }
  if (fLower.includes('iat')) {
    return 'Irregular packet inter-arrival timing contributed to threat detection.';
  }

  return `High value in feature '${featureName}' significantly influenced the ML prediction model.`;
}
