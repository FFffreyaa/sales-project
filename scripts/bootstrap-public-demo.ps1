$ErrorActionPreference = 'Stop'
$baseUrl = $env:PUBLIC_DEMO_BASE_URL
if (-not $baseUrl -or -not $baseUrl.StartsWith('https://')) { throw 'PUBLIC_DEMO_BASE_URL 必须是 HTTPS 站点。' }
$baseUrl = $baseUrl.TrimEnd('/')
$today = [DateTime]::UtcNow
$requestDate = $today.ToString('yyyy-MM-dd')
$samples = @(
  [pscustomobject]@{ Id='DIRECT-BID'; Scenario='SCN-01-DIRECT-BID'; Grade='A'; Name='公开演示｜110kV主变采购'; Customer='华东某省电网公司'; FinalCustomer='华东某省电网公司'; Target='110kV主变压器2台'; Amount=8500000; RequestRef='DEMO-TENDER-001'; TenderNo='DEMO-TENDER-001'; Batch=$null; Location='华东地区项目现场'; Country='中国'; Due=$today.AddDays(28).ToString('yyyy-MM-dd') },
  [pscustomobject]@{ Id='EPC-INQUIRY'; Scenario='SCN-02-EPC-INQUIRY'; Grade='S'; Name='公开演示｜新能源升压站设备询价'; Customer='某工程设计院EPC项目部'; FinalCustomer='华北某新能源项目业主'; Target='220kV升压变压器及配套设备'; Amount=12000000; RequestRef='DEMO-EPC-RFQ-001'; TenderNo=$null; Batch='DEMO-EPC-BATCH-001'; Location='华北地区项目现场'; Country='中国'; Due=$today.AddDays(35).ToString('yyyy-MM-dd') },
  [pscustomobject]@{ Id='DIRECT-RFQ'; Scenario='SCN-03-DIRECT-RFQ'; Grade='B'; Name='公开演示｜园区配电变压器询价'; Customer='华南某制造企业'; FinalCustomer='华南某制造企业'; Target='10kV干式变压器及配套柜体'; Amount=4200000; RequestRef='DEMO-DIRECT-RFQ-001'; TenderNo=$null; Batch=$null; Location='华南某工业园区'; Country='中国'; Due=$today.AddDays(21).ToString('yyyy-MM-dd') },
  [pscustomobject]@{ Id='OVERSEAS-EPC'; Scenario='SCN-04-OVERSEAS-PARTNER-EPC'; Grade='A'; Name='公开演示｜海外电力项目EPC询价'; Customer='某国际工程EPC项目部'; FinalCustomer='东南亚某电力项目业主'; Target='海外变电站主变及属地服务'; Amount=18000000; RequestRef='DEMO-OVERSEAS-EPC-001'; TenderNo=$null; Batch='DEMO-OVERSEAS-BATCH-001'; Location='印度尼西亚某项目现场'; Country='印度尼西亚'; Due=$today.AddDays(45).ToString('yyyy-MM-dd') }
)

function Invoke-DemoJson {
  param([string]$Uri, [hashtable]$Headers, [string]$Body)
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try { return Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -ContentType 'application/json' -Body $Body }
    catch {
      if ($attempt -eq 4 -or $_.Exception.Response) { throw }
      Start-Sleep -Seconds $attempt
    }
  }
}

foreach ($sample in $samples) {
  $eventId = "PUBLIC-DEMO-SEED-V1-$($sample.Id)"
  $isEpc = $sample.Scenario -like '*EPC*'
  $event = @{
    eventId=$eventId; eventType='LeadQualifiedForConversion'; sourceSystem='LEAD_MANAGEMENT_SIMULATOR'; environment='demo'; simulated=$true; occurredAt=$today.ToString('o')
    lead=@{ id=$eventId; code="DEMO-LEAD-$($sample.Id)"; type=$(if($sample.Scenario -eq 'SCN-01-DIRECT-BID'){'tender'}else{'demand'}); category='项目线索'; grade=$sample.Grade; score=80; authenticityStatus='manual_confirmed'; authenticityBasis='公开演示专用脱敏样本，不代表真实客户或真实商机。'; sourceChannel='public_demo_seed'; assignedOwnerExternalId='sales-chen'; assignedOwnerName='陈晨'; submitterExternalId='public-demo-seed'; submitterName='公开演示初始化'; submittedAt=$today.ToString('o') }
    opportunity=@{ projectName=$sample.Name; customerName=$sample.Customer; finalCustomerName=$sample.FinalCustomer; projectCountry=$sample.Country; deliveryCountry=$sample.Country; productScope=$sample.Target; amount=@{type='exact';minYuan=$sample.Amount;maxYuan=$sample.Amount;currency='CNY'}; procurementProgress='公开演示待人工转化'; procurementMethod=$(if($sample.Scenario -eq 'SCN-01-DIRECT-BID'){'tender'}elseif($isEpc){'epc_inquiry'}else{'direct_rfq'}); requestingPartyName=$sample.Customer; requestingPartyRole=$(if($isEpc){'epc'}else{'end_customer'}); submissionRecipientName=$sample.Customer; suggestedScenarioCode=$sample.Scenario; requestRef=$sample.RequestRef; requestDate=$requestDate; tenderNo=$sample.TenderNo; deliveryLocation=$sample.Location; submissionDeadline=$sample.Due; sourcePlatform='公开演示初始化'; customerMaster=@{code="DEMO-CUSTOMER-$($sample.Id)";matchStatus='temporary'} }
    initialRequirement=@{ originalText="$($sample.Target)；详细参数与商务边界待项目阶段澄清。"; productRequirement=$sample.Target; knownConstraints=@($sample.Location); unknowns=@('正式技术参数待澄清','最终交付与商务条件待确认'); sourceRefs=@("$eventId`:INITIAL-REQUIREMENT") }
    evidenceRefs=@("$eventId`:SOURCE"); competitors=@(); keyRoles=@(); partners=@(); contacts=@(); followups=@(); attachments=@(); teamCandidates=@(); parties=@(); fieldProvenance=@{dataClass='PUBLIC_ANONYMIZED_DEMO';disclosure='非真实客户、非真实商机、非生产接口数据'}
  }
  $lead = Invoke-DemoJson -Uri "$baseUrl/api/integration/lead/events" -Headers @{Origin=$baseUrl;'Sec-Fetch-Site'='same-origin'} -Body ($event | ConvertTo-Json -Depth 12 -Compress)
  if ($lead.projectCode) { Write-Output "已存在 $($lead.projectCode)"; continue }
  $project = @{ scenarioCode=$sample.Scenario; evidence="$eventId`:SOURCE"; finalCustomer=$sample.FinalCustomer; sourceCustomer=$sample.Customer; target=$sample.Target; amount=$sample.Amount; procurementProjectName=$sample.Name; requestRef=$sample.RequestRef; requestDate=$requestDate; deliveryLocation=$sample.Location; projectCountry=$sample.Country; deliveryCountry=$sample.Country; bidDate=$sample.Due; leadGrade=$sample.Grade; organization='公开演示组织'; firstAction='核对线索快照并准备G1立项材料'; ownerUserId='sales-chen'; leadConversionId=$lead.inboxId; submitG1=$true }
  if ($sample.TenderNo) { $project.tenderNo = $sample.TenderNo }
  if ($sample.Batch) { $project.inquiryBatch = $sample.Batch }
  $created = Invoke-DemoJson -Uri "$baseUrl/api/p0/projects" -Headers @{'x-demo-actor-id'='sales-chen'} -Body ($project | ConvertTo-Json -Depth 8 -Compress)
  Write-Output "已创建 $($created.projectCode) $($sample.Name)"
}
