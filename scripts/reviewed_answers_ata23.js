module.exports = {
  q_23_d0f057bd346f: {
    evidence_page_codes: ['D1-01', 'D1-02', 'D1-03', 'D1-08', 'D1-09', 'D1-10', 'D1-15', 'D1-16', 'D2-01', 'D2-02', 'D2-03', 'D2-04', 'D2-05'],
    answer_lines: [
      'FI System目的: Flight Crew相互、Ground Crew、Communication System Access、Navigation Receiver Monitorに使用する音声System。',
      'FI構成/Location: ACP、REU、Remote MIC Switch、Control Wheel MIC Switch、Flight Interphone Speaker、Hand/Oxygen/Boom MIC Jack、Headphone Jack。REUはE4-1 Rack、External Flight Interphone JackはP19 External Power Panel。',
      'FI作動概要: CrewがACPでTransmitter/Receiver/Volume/PTTを選ぶ。MIC AudioとPTTはREUを経由してCommunication Transceiverへ行き、受信AudioはREUからHeadset/Headphone/Speakerへ戻る。',
      'REU機能: Captain/F/O/ObserverのStation CardとAAU Cardで、Flight Interphone、Service Interphone、PA、Communication/Nav Audio、Alert Toneを選択・合成・増幅・分配する。',
      'ACP Emergency Operation: ALTを選ぶとEmergency Modeになり、通常回路をBypassする。Captain/ObserverはVHF-1、F/OはVHF-2に接続され、PTT R/Tのみで送受信する。Hand Micは使用不可。',
      'Navigation/Alert Audio 4つ: GPWS/GPWC、Weather Radar Windshear、TCAS、FCC Altitude Alert/Altitude Window Alert。',
      'SI System目的: Flight Crew、Cabin Attendant、Ground Crew間のService Interphone通話を行う。',
      'SI構成/Location: Service Interphone SwitchはP5 Aft Overhead Panel、Handset Interphone JackはP8 Aft Electronic Panel aft face、Attendant HandsetはForward/Aft Attendant Station、Service Interphone JackはE/E Compartment、Fueling Station、左右Wheel Well、Aft Cabin、APU Service Area。',
      'SI作動概要: REUのAAU CardがFlight Compartment MIC、Flight Compartment Handset、Attendant Handset、Service Interphone JackのAudioをMix/Amplifyし、Flight Crew Headset/Speaker、Service Headset、Attendant Handsetへ送る。'
    ]
  },
  q_23_709bc1feb618: {
    evidence_page_codes: ['D2-02', 'D2-03', 'D2-04', 'D2-05', 'D3-01', 'D3-02', 'D3-03', 'D3-04', 'D3-05', 'D4-01', 'D4-04', 'D4-05', 'D4-06'],
    answer_lines: [
      'SI Jack Location: E/E Compartment、Fueling Station、Right Wheel Well forward fairing exterior前、Left Wheel Well forward fairing exterior前、Aft Cabin Attendant Station上方天井、APU Service AreaのSection 48 Access Door近傍。',
      'P5 SI Switch: P5 Aft Overhead PanelのService Interphone Switch。ON時、External Service Interphone JackのMicrophone InputをService Interphoneに接続し、Ground CrewがFlight Crew/Attendant/Ground Crew間で通話できる。',
      'GND Crew Call: Flight CompartmentのP5 Passenger Sign PanelにあるGRD CALL Switchを押すと、Nose Wheel Well forward wallのGround Crew Call Hornが鳴る。ReleaseでHorn停止。',
      'GroundからFlight Crew Call: P19 External Power PanelのPILOT CALL Switchを押すと、REUとAural Warning ModuleへSignalが行き、ACPのINT Call Light点灯とFlight Compartment High Chimeが発生する。ReleaseでINT Call Light消灯。',
      'CabinからFlight Crew Call: Attendant Handsetの2 ButtonでPilot Call。Aural Warning ModuleがHI Chimeを鳴らし、REUがACPのCABIN Call Lightを点灯させる。Reset ButtonまたはHandsetをCradleに戻すと消灯する。'
    ]
  },
  q_23_b55819d2f5f9: {
    evidence_page_codes: ['D4-01', 'D4-02', 'D4-04', 'D4-05', 'D4-06'],
    answer_lines: [
      'CBN to CBNはAttendant Station間の呼出しで、Attendant Handsetを使用する。',
      '呼出側がHandsetの5 Buttonを押すと、Encoded SignalがHandset Logic Control CardのTone Decoderへ入る。',
      '相手側Attendant StationのAttendant Call Lightが点灯し、PA AmplifierへDiscrete Signalが送られてCabin SpeakerでHI/LO Chimeが鳴る。',
      'Call Lightは相手がHandsetをCradleから持ち上げると消える。すでにOff Hookの場合はRESET Buttonで消す。',
      'HandsetがPA Modeに入っている場合、Attendant Call前にRESETを押してPAから切り離す必要がある。'
    ]
  },
  q_23_32e5be43f528: {
    evidence_page_codes: ['D4-04', 'D5-01', 'D5-03', 'D5-04', 'D5-05', 'D5-08', 'D5-10', 'D5-15', 'D5-16'],
    answer_lines: [
      'ATT PNL内のCard: Forward/Aft Attendant PanelにはHandset Logic Control Cardがあり、Crew Call CircuitとCabin Interphone Circuitを扱う。',
      'PA System機能4つ: PA Announcement、Chime、Boarding Music、Pre Recorded Announcement。',
      'PA主要Component/Location: PA AmplifierはE1-3 Shelf、Passenger Sign PanelはP5 Forward Overhead Panel、PA MIC Connector/PA Hand MICはP8 Aft Electronic Panel、PRAMはForward Lavatory wall、Attendant HandsetはForward/Aft Attendant Station、PSU/Cabin/Lavatory/Attendant SpeakerはPassenger Cabin。',
      'PA Amp機能: 入力AudioのPriority判定、最優先Audioの増幅、PSU/Lavatory/Attendant SpeakerやPES/REUへのAudio送出、Chime生成、Side Tone送出、Speaker Network/Output Level/Test機能、Gain Controlを行う。',
      'PA Priority: 1 Flight Compartment Announcement、2 Attendant Announcement、3 Pre Recorded Announcement、4 Video Entertainment Audio、5 Boarding Music。ChimeはPriority Logicに影響されず他Audioと同時に流れる。'
    ]
  },
  q_23_0e4df080c2cd: {
    evidence_page_codes: ['D5-05', 'D5-06', 'D5-10', 'D5-15'],
    answer_lines: [
      'PA Gain ControlはREUからのGain SignalでPA Amplifier Gainを変える。',
      'REUはEngine Running Relay入力を受け、Engine 1または2が作動するとCabin Noise上昇に合わせてPA Amplifier Gainを6 dB上げる。',
      'Decompression時はOxygen Indicator RelayがSignalを出し、Cabin Noise上昇に合わせてさらに3 dB Gainを上げる。',
      'Master Gain Control PotentiometerではPA Amplifierの基本Gainを調整する。通常はFunction Select SwitchをLEVEL positionにして70.7 Vが表示されるよう調整する。'
    ]
  },
  q_23_2f14945bd648: {
    evidence_page_codes: ['D5-01', 'D5-05', 'D5-06', 'D5-18', 'D6-01', 'D6-02', 'D6-03', 'D6-04', 'D6-10', 'D6-11', 'D6-12', 'D6-13'],
    answer_lines: [
      'CaptainからCabinへのPA経路: Captain Mic/Boom/Oxygen/Hand MicでPAを選択しPTTを押す -> ACP/REU経由でPA AmplifierへFlight Compartment AudioとPTTが入る -> PA AmplifierがPriority 1として増幅 -> PSU Speaker、Lavatory Speaker、Cabin/Attendant Speaker系へ送る。',
      'Side ToneはPA AmplifierからREUへ戻り、Flight Crew Headset/Flight Compartment SpeakerでMonitorできる。',
      'VHF System目的: 118.000から136.975 MHzで、航空機間および地上局との見通し距離のVoice/Data Communicationを行う。',
      'VHF主要Component: RCP、VHF Transceiver、VHF Antenna、ACP/REU、SELCAL Decoder、PSEU、FDAU。VHF 3はACARS MUとも接続する。',
      'VHF Location: RCPはP8 Aft Electronic Panel、VHF Transceiver 1はE1-3、2はE1-5、3はE3-3 Shelf、VHF AntennaはFuselage top/bottom center line上。',
      'VHF作動概要: RCPがTuning DataをTransceiverへ送り、REUがMIC Audio/PTTを送る。TransceiverがRF Carrierを変調してAntennaから送信し、受信時はRFからAudioを取り出してREUへ戻す。'
    ]
  },
  q_23_4830dd957c66: {
    evidence_page_codes: ['D6-04', 'D7-01', 'D7-03', 'D7-04', 'D7-05', 'D7-06', 'D7-07', 'D7-09', 'D7-10'],
    answer_lines: [
      'VHF Antenna Location: FuselageのTopおよびBottomのCenter Line上。',
      'HF Antenna Location: HF AntennaはVertical Stabilizer Leading Edge、HF Antenna CouplerはVertical Stabilizer内部。',
      'HF System目的: Flight Crewに長距離Voice Communicationを提供し、航空機間および航空機-地上局間で通信する。2.000から29.999 MHzを使用し、地表面/電離層反射を利用する。',
      'HF主要Component: RCP、HF Transceiver、HF Antenna Coupler、HF Antenna、ACP/REU、SELCAL Decoder、PSEU、FDAU。',
      'HF Location: RCPはP8 Aft Electronic Panel、ACPはP8/P5、HF TransceiverはE6-2 Shelf、Antenna CouplerはVertical Stabilizer内、AntennaはVertical Stabilizer Leading Edge。',
      'HF作動概要: RCPがFrequency/ModeをTransceiverへ送り、REUがMIC Audio/PTTを送る。Transmit前にCouplerがTransceiver 50 ohm outputとAntenna impedanceを整合し、VSWRを1.3:1以下にしてAntennaへRFを送る。'
    ]
  },
  q_23_07c949aa27ac: {
    evidence_page_codes: ['D6-08', 'D6-09', 'D7-10', 'D7-12', 'D7-14', 'D7-15', 'D7-17', 'D7-18'],
    answer_lines: [
      'RCP故障時の現象: RCP内部故障ではActive Frequency IndicatorにFAIL表示、Standby Frequency IndicatorはBlankになる。',
      'RCP故障時の運用: 故障したRCPのPort Select Discreteが切り替わり、他のRCPからCrosstalk/Output Tune Bus経由で該当VHF TransceiverをTuningできる。',
      'HF Coupler機能: Transceiverの50 ohm Output Impedanceと選択FrequencyにおけるAntenna Impedanceを整合させ、VSWRを1.3:1以下に下げる。',
      'HF CouplerはTransmit前のTune ModeでRF Carrierを受け、Tune A/B/CでResonance、Load、VSWRを調整する。Tune中は1 kHz toneが聞こえ、通常2から4秒、最大7秒で完了する。',
      '1 kHz toneが止まると送信可能。15秒以上続く場合はCoupler Failが疑われる。'
    ]
  },
  q_23_5d5419c3366e: {
    evidence_page_codes: ['D8-01', 'D8-05', 'D8-07', 'D8-08', 'D9-01', 'D9-02', 'D9-03', 'D9-04', 'D9-06', 'D9-07', 'D9-15', 'D9-16', 'D10-01', 'D10-03', 'D10-04', 'D10-05', 'D10-07', 'D10-08', 'D11-01', 'D11-02', 'D11-03', 'D11-08', 'D11-09'],
    answer_lines: [
      '機体識別(SELCAL): SELCAL Program Switch Moduleの4つのDIP Switch Groupで4 Letter Codeを設定する。各Letterは異なるAudio Toneに対応する。',
      '機体が呼び出された時のCaptain表示: 該当VHF/HF/SATCOM Transmitter SelectorのCall Lightが点灯し、Aural Warning ModuleがHI/LO Chimeを鳴らす。SELCALはACP Call Light、SATCOMはCDU Channel StatusにINCOMING CALL/CONNECTED等も表示する。',
      'SATCOM目的: AircraftとGround Earth Station/Satellite Network間で長距離のVoice/Data Communicationを行うMobile Communication System。',
      'SATCOM主要Component/Location: SDU、HPA、Program Switch Module、FanはAft Cargo Compartment E6 Rack、LNA/DIPはCabin Ceiling上、HGAはFuselage上部、CDU/ACPはFlight Compartment。',
      'LNA/Diplexer働き: 受信Low Level Satellite Signalを増幅し、Diplexer FilterとTransmit/Receive Switchで送信/受信を同時に扱えるようにする。TransmitはHPAからAntennaへ、ReceiveはAntennaからLNA/SDUへ通す。',
      'ACARS目的: 航空機とAirline地上局間のDatalink Communication。Downlink/Uplink、OOOI、Engine Performance、Flight Status、Maintenance Item等を扱い、Crew Workloadを下げる。',
      'ACARS主要Component/Location: CDUはP9 Forward Electronic Panel、RCP/ACPはP8/P5、PrinterはP9、ACARS MU/Program Switch Module/APMはE4-1 Shelf。VHF 3、Printer、PSEU、FMCS、FDAU、Data Loader、SDUともInterfaceする。',
      'ACARS識別: APMがAirplane Identification CodeとRegistration Number CodeをCMUへ供給し、MUはRegistration Code付きUplinkのみ処理し、Downlinkにも同じ識別Codeを付ける。',
      'Voice Recorder目的/作動: Flight Crew Communication、Flight Compartment Sound、Timeを常時録音し、最新120分をMemoryに保持する。REUとArea MicrophoneからAudioを受ける。',
      'Voice Recorder構成/Location: Cockpit Voice Recorder PanelはP5 Forward Overhead、Voice Recorder UnitはAft Cargo Compartment E6 Rack、Monitor JackはP28 APU Ground Control Panel、ULBはRecorder Unit Front Panel。',
      'Voice Recorder作動時期: AirplaneにPowerがありVoice Recorder Circuit BreakerがCloseしていると連続作動する。',
      'Bulk Erase: Airplane On GroundかつParking Brake Set時のみErase可能。Erase Switchを保持するとCSMU/Memory内の全Audio Dataを消去し、Erase中はHeadphone Jackで400 Hz toneが聞こえる。'
    ]
  },
  q_23_b63c14ea4033: {
    evidence_page_codes: ['D11-01', 'D11-03', 'D11-05', 'D11-07', 'D11-08'],
    answer_lines: [
      'Voice Recorderは最後の120分間をMemoryに保持する。',
      '記録音声は4 Channel: Captain Microphone/Headphone、First Officer Microphone/Headphone、First Observer Microphone/Headphone、Cockpit Voice Recorder PanelのArea Microphone。',
      'Captain/F/O/Observerの音声はREUで各StationのMicrophone AudioとHeadphone Audioを合成・増幅してVoice Recorderへ送る。',
      'Area MicrophoneはFlight CompartmentのVoiceやAural Warning音を収集する。',
      'MonitorはCockpit Voice Recorder PanelのHeadphone Jack、またはP28 APU Ground Control PanelのCVR Monitor JackにHeadsetを接続して行う。Mixed Recorded Audioを聞ける。'
    ]
  },
  q_23_c8c2293bfc89: {
    evidence_page_codes: ['D11-03', 'D11-04', 'D11-05', 'D11-08', 'D11-09', 'D11-11'],
    answer_lines: [
      'Voice RecorderのOFF L/Tは、Recorderが正常に記録できない、またはSystem Testで正常確認できない状態を示す表示として扱う。',
      'Study Guide上の該当表示はVoice Recorder UnitのBITE Indicator/Status Indicatorで説明されており、Voice Recorder Unit FaultがあるとBITE Indicatorが点灯する。',
      'System Test正常時はHeadphone JackでTest Toneが聞こえ、Green Status Indicatorが一瞬点灯し、BITE IndicatorはOffのまま。',
      'Test Fail時はGreen Status IndicatorがOffのままで、Voice Recorder BITE Indicatorが点灯する。Power/Circuit Breaker、Recorder Unit Fault、Audio/recording circuitの不具合確認が必要。'
    ]
  },
  q_23_3e6e83d619cd: {
    evidence_page_codes: ['D12-01', 'D12-02', 'D12-03', 'D12-04', 'D12-05', 'D12-07'],
    answer_lines: [
      'ELT目的: 急激な機速変化を感知しEmergency Signalを自動送信する。Search/Rescue CrewへVHF/UHF Homing Signalを送り、Satelliteへ位置計算用のEmergency Signalも送る。',
      '主要Component/Location: ELT Control PanelはP5 Aft Overhead Panel、ELT TransmitterはAft Passenger Cabin Ceiling Access Panel上部 STA 794、ELT AntennaはFuselage上部 STA 797。',
      'ELT構成: Control Panel、ELT Transmitter、Antenna。Transmitter内部にはG Switch、Battery Pack、406 MHz Transmitter、121.5/243 MHz Transmitter、ON Light/Switchがある。',
      '自動作動: Control Panel SwitchとTransmitter Front Panel SwitchがARMEDで、G Switch/Acceleration Sensorが過大な速度変化を検知すると作動する。',
      '手動作動: ELT Control Panel SwitchをON、またはTransmitter Front Panel SwitchをONにすると、EXT ON/Front Switch操作によりTransmitterをStartさせる。',
      '通常状態: Control Panel/Transmitter Front PanelともARMED、ELT LightとMaster CautionはOff。'
    ]
  },
  q_23_d3860b5a7039: {
    evidence_page_codes: ['D12-01', 'D12-03', 'D12-04', 'D12-05', 'D12-06', 'D12-07', 'D12-08'],
    answer_lines: [
      'ELT電波: 121.5 MHz Homing Signal、243.0 MHz Homing Signal、406 MHz Digital Distress Signalを送信する。',
      '121.5/243 MHz: VHF/UHF Emergency ChannelのSwept Tone/Homing Signalで、406 MHz送信中以外はBatteryが続く限り連続送信する。位置精度は約20 km。',
      '406 MHz: COSPAS/SARSAT向けDigital Signalで、約50秒ごとに短時間(約440 msec)送信する。ELT Serial Number、Country Code、Aircraft Operator/Serial、24 bit Address、Nationality/Registration等を含み、位置精度は約2 km。',
      '電源/持続: ELTはInternal Batteryで作動し、Battery Packは少なくとも60時間作動する。',
      '取扱注意: Self TestはON後50秒以内に行う。誤送信を避け、Test後は使用したSwitchをOff/ResetしてARMEDへ戻す。Emergency使用後、使用時間不明、1時間以上使用、交換期限、Leak/Corrosion/消耗時はBattery交換が必要。',
      '手動作動後の停止: Control PanelまたはELT Front Panelの作動に使ったSwitchをOFF/RESET側にして送信を止め、その後通常位置ARMEDへ戻す。Control PanelのRESET操作は約1から3秒保持してからARMEDへ戻す。'
    ]
  },
  q_23_9ab5dd8fcb63: {
    evidence_page_codes: ['D13-01', 'D14-01', 'D14-02', 'D14-03', 'D14-04'],
    answer_lines: [
      'Static Discharger目的: 機体に帯電した静電気を胴体から遠い位置で放電し、無線通信機器や受信Antennaへの干渉を最小にする。',
      'Static Discharger Location: 各WingにTrailing Edge Discharger 2個、Vertical FinにTip Discharger 1個とTrailing Edge Discharger 3個、Horizontal Stabilizer各SideにTip Discharger 1個とTrailing Edge Discharger 2個。',
      'PES Audio目的: 各Passenger SeatへRecorded Entertainment AudioとPassenger Address Audioを送り、Passengerが複数Audio Channelから選択して聞けるようにする。',
      'PES Audio主要Component/Location: Audio Entertainment Player(AEP)とAudio Multiplexer(AMUX)はE/E Compartment、BITE Panel/Seat Electronics Box/Passenger Control UnitはPassenger Compartment、Forward Attendant PanelでPower Controlを行う。',
      'PES Audio機能: AEP/PES Video/PASからAudio Inputを受け、AMUXがAnalog AudioをDigitalに変換して各Column最初のSEBへ送り、SEBが選択ChannelをAudioに戻してPCU Headphone Jackへ送る。',
      'PA Override: Passenger Address Announcement中はEntertainment Audioを停止し、全PCUへPA Announcementを送る。Passengerはその間Channel変更できない。'
    ]
  },
  q_23_3f4cfd02c8ea: {
    evidence_page_codes: ['D17-01', 'D17-02', 'D17-03', 'D17-04', 'D17-05'],
    answer_lines: [
      'Video Surveillance SystemはFDEVSSで、Flight CrewがFlight Deck Entry DoorおよびForward Left/Right Entry Door付近を監視するためのSystem。',
      '主要Component: 3つのNear-Infrared/Black and White Video Camera、Video Interface Unit(VIU)、Camera Control Panel(CP)、Lower Center Multi-Function Display(MFD)。',
      'Location: CPはP8 Aft Electronic Panel、Lower Center MFDはFlight Compartment、VIUはPassenger CabinのSTA 336.47 LBL9.60 Ceiling Panel Frame、Camera 1/2/3はFlight Deck Door近辺のCeilingに装備。',
      '不可欠なSystem/Interface: VIUは115 V AC Transfer Bus 1をP6 CCB経由で受け、各Cameraへ12 V DCを供給する。CameraはVIUへ白黒Video Signalを送り、CDS/MFDがLower Center Displayに映像を表示する。',
      'CPのDSPL ButtonとCamera Selectが必要で、VIUは選択された1台のCamera SignalのみをLower Center Displayへ送る。'
    ]
  },
  q_23_60ffdf58f819: {
    evidence_page_codes: ['D17-02', 'D17-04', 'D17-05'],
    answer_lines: [
      'FDEVSS映像はLower Center Multi-Function Displayに表示される。',
      '表示方法: Camera Control Panelの3-Position Rotary SwitchでCamera 1(L)、Camera 2(C)、Camera 3(R)のいずれかを選択し、DSPL(Display) Buttonを押す。',
      'DSPL ButtonによりMFDへVideo表示Discreteが送られ、VIUからの選択Camera映像がLower Center Displayに表示される。',
      '同時表示できるのは1 Cameraのみで、2つ以上のCamera映像は同時に表示できない。'
    ]
  }
};
