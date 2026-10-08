from pathlib import Path
import yaml,csv,re,json
D=Path(__file__).parent
s=yaml.safe_load((D/'07-openapi-v7.yaml').read_text());sc=s['components']['schemas'];checks=[];refs=[]
def check(name,ok):
 assert ok,name
 checks.append(name)
def walk(v):
 if isinstance(v,dict):
  if '$ref' in v:refs.append(v['$ref'])
  for x in v.values():walk(x)
 elif isinstance(v,list):
  for x in v:walk(x)
walk(s)
for r in refs:
 assert r.startswith('#/'),r
 node=s
 for p in r[2:].split('/'):node=node[p.replace('~1','/').replace('~0','~')]
check('All internal refs resolve',True)
ops=[o for v in s['paths'].values() for m,o in v.items() if m in ['get','post','put','patch','delete']]
check('Unique operationIds',len({o['operationId'] for o in ops})==len(ops))
check('All operations declare security/x-authz/x-audience',all(all(k in o for k in ['security','x-authz','x-audience']) for o in ops))
check('All named schemas are mappings',all(isinstance(v,dict) for v in sc.values()))
check('No legacy Service/branch deposit config',not any(k in json.dumps(sc) for k in ['depositConfig','depositRequired','depositType','depositValue']))
check('Threshold belongs to Stock, not InventoryItem','lowStockThreshold' in sc['Stock']['properties'] and 'lowStockThreshold' not in sc['InventoryItem']['properties'])
check('Threshold update endpoint exists',s['paths']['/inventory/stocks/{branchId}/{inventoryItemId}/threshold']['put']['operationId']=='inventoryThresholdUpdate')
check('Guest and Customer can access deposit mock completion',s['paths']['/payments/{id}/mock/complete']['post']['security']==[{'bearerAuth':[]},{'guestLookupToken':[]}])
base={'id':'1'*24,'targetId':'2'*24,'amount':300000,'provider':'MOCK','status':'PENDING'}
def matches_payment_branch(obj,branch):
 for field,rule in branch['properties'].items():
  if 'const' in rule and obj[field]!=rule['const']:return False
  if 'enum' in rule and obj[field] not in rule['enum']:return False
 return True
valid=[('APPOINTMENT','ONLINE_MOCK','FULL'),('APPOINTMENT','ONLINE_MOCK','DEPOSIT'),('APPOINTMENT','PAY_AT_STORE','BALANCE'),('ORDER','ONLINE_MOCK','ORDER'),('ORDER','COD','ORDER')]
import itertools
for target,method,kind in itertools.product(['APPOINTMENT','ORDER'],['ONLINE_MOCK','PAY_AT_STORE','COD'],['FULL','DEPOSIT','BALANCE','ORDER']):
 obj=base|{'targetType':target,'method':method,'kind':kind};accepted=sum(matches_payment_branch(obj,b) for b in sc['Payment']['oneOf'])==1
 assert accepted==((target,method,kind) in valid),(target,method,kind)
check('Payment oneOf enum/const rules accept exactly 5 of 24 target/method/kind combinations',True)
check('Create response links prepayment','prepaymentId' in sc['Appointment']['required'])
check('Both business decisions confirmed by user',s['x-review-status']['refundPolicy']=='CONFIRMED_BY_USER_2026_10_08' and s['x-review-status']['medicalReviewer']=='CONFIRMED_BY_USER_2026_10_08')
rules=s['x-confirmed-business-rules'];refund=rules['appointmentRefund'];medical=rules['medical']
check('Refund: exact 24h boundary, online late/no-show 30% penalty, 70% refund',refund['customerCancelEarlyBoundaryHours']==24 and refund['earlyComparison']=='>=' and refund['lateComparison']=='<' and refund['earlyRefundPercent']==100 and refund['lateRetainedPercent']==30 and refund['lateOnlineRefundPercent']==70 and refund['noShowRetainedPercent']==30 and refund['storeSystemRefundPercent']==100)
check('Medical allows Nurse and/or Vet segments and requires Vet review/finalize',medical['allowedExecutionRoles']==['NURSE','VETERINARIAN'] and medical['requiresVeterinarianExecutionSegment'] is False and medical['directVetParticipationRequiredStaffRole']=='VETERINARIAN' and medical['nurseCanFinalize'] is False and medical['reviewState']=='WAITING_VET_REVIEW' and medical['requiredReviewAndFinalizeRole']=='VETERINARIAN')
submit=s['paths']['/service-records/{id}/submit-review']['post']['x-authz']
finalize=s['paths']['/service-records/{id}/finalize']['post']['x-authz']
check('Nurse submit routes completed Medical execution to Vet review',submit['roles']==['NURSE'] and 'WAITING_VET_REVIEW' in submit['stateTransition'])
check('Medical finalize contract excludes Nurse and requires all segments complete',finalize['roles']==['CARE_STAFF_GROOMER(GROOMING)','VETERINARIAN(MEDICAL)'] and 'all segments COMPLETED' in finalize['stateTransition'] and 'reviewerStaffId == actor' in finalize['scope'])
check('No pending decision labels remain in OpenAPI',not any(x in json.dumps(s) for x in ['PROPOSED_PENDING_TEAM_CONFIRMATION','x-proposed-decision','PROPOSED']))
check('ONLINE full forfeiture override prohibited','Reject FORFEIT for ONLINE_MOCK' in sc['CancelOverrideRequest']['description'] and 'ONLINE_MOCK FORFEIT rejected' in s['paths']['/appointments/{id}/cancel-override']['post']['x-authz']['sideEffects'])
counts={}
for f in D.glob('*.csv'):
 rows=list(csv.reader(f.open()));check(f.name+' uniform column count',all(len(r)==len(rows[0]) for r in rows));counts[f.name]=len(rows)-1
texts='\n'.join(p.read_text() for p in D.glob('*.md') if not p.name.startswith('00-'))
check('No missing v2 schema dependency',not re.search(r'nhu v2|như v2',texts,re.I))
report='# 18 V7 bounded static audit\n\nGenerated from current package by 19-contract-check-v7.py. This checks syntax, refs, schema combinations and selected contract invariants; it is not an exhaustive semantic review or implementation test.\n\n'
report+='\n'.join('- PASS: '+x for x in checks)+'\n\n'
report+=f'Paths: {len(s["paths"])}. Operations: {len(ops)}. Schemas: {len(sc)}. Internal ref occurrences: {len(refs)}.\n\n'
report+='\n'.join(f'- {k}: {v} data rows' for k,v in counts.items())+'\n\n'
report+='Runtime/concurrency/payment-provider tests: NOT RUN (no implementation supplied). Fresh live Sheet reconciliation: NOT PERFORMED; file 17 is a proposed sync. Business decisions confirmed by user on 08/10/2026 (Asia/Saigon): online late cancellation/no-show retains 30% and refunds 70%; Medical allows Nurse/Vet execution and mandates Veterinarian review/finalization. V7 schema supplementary fields are canonical design proposals, not verified extraction from v2/DB. Full OpenAPI specification validation tool is unavailable; the checks above do not claim full OAS compliance.\n'
(D/'18-static-audit-v7.md').write_text(report)
print(report)
