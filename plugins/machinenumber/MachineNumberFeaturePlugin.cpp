/*
 * MachineNumberFeaturePlugin.cpp - tự nhận diện số máy
 *
 * Phát hành theo GPL v2 (như Veyon).
 */

#include <QApplication>
#include <QDialogButtonBox>
#include <QInputDialog>
#include <QMessageBox>
#include <QUuid>

#include "BuiltinDirectoryConfiguration.h"
#include "ComputerControlInterface.h"
#include "FeatureWorkerManager.h"
#include "MachineNumberFeaturePlugin.h"
#include "NetworkObject.h"
#include "NetworkObjectDirectory.h"
#include "NetworkObjectDirectoryManager.h"
#include "ObjectManager.h"
#include "PlatformCoreFunctions.h"
#include "VeyonConfiguration.h"
#include "VeyonCore.h"
#include "VeyonMasterInterface.h"
#include "VeyonServerInterface.h"
#include "VeyonWorkerInterface.h"


// Plugin tự có bản triển khai riêng của proxy cấu hình (ký hiệu bị ẩn nên không đụng plugin danh bạ)
IMPLEMENT_CONFIG_PROXY(BuiltinDirectoryConfiguration)


MachineNumberFeaturePlugin::MachineNumberFeaturePlugin( QObject* parent ) :
	QObject( parent ),
	m_feature( QStringLiteral( "MachineNumber" ),
			   Feature::Flag::Action | Feature::Flag::AllComponents,
			   Feature::Uid( "150e3912-087a-42f2-8bfe-5a1e38cb0422" ),
			   Feature::Uid(),
			   tr( "Identify computer numbers" ), {},
			   tr( "Ask the user of each selected computer for the number written on the computer. "
				   "The computer is then renamed automatically, so cabling order no longer matters." ),
			   QStringLiteral(":/core/document-edit.png") ),
	m_features( { m_feature } )
{
}



const FeatureList& MachineNumberFeaturePlugin::featureList() const
{
	return m_features;
}



QString MachineNumberFeaturePlugin::machineName( int number )
{
	return tr( "Computer %1" ).arg( QString::number( number ).rightJustified( 2, QLatin1Char('0') ) );
}



bool MachineNumberFeaturePlugin::controlFeature( Feature::Uid featureUid, Operation operation,
												 const QVariantMap& arguments,
												 const ComputerControlInterfaceList& computerControlInterfaces )
{
	Q_UNUSED(arguments)

	if( featureUid != m_feature.uid() || operation != Operation::Start )
	{
		return false;
	}

	sendFeatureMessage( FeatureMessage{ featureUid, FeatureCommand::AskNumber }, computerControlInterfaces );

	return true;
}



bool MachineNumberFeaturePlugin::startFeature( VeyonMasterInterface& master, const Feature& feature,
											   const ComputerControlInterfaceList& computerControlInterfaces )
{
	if( feature.uid() != m_feature.uid() )
	{
		return false;
	}

	if( computerControlInterfaces.isEmpty() )
	{
		QMessageBox::information( master.mainWindow(), m_feature.displayName(),
								  tr( "Please select the computers to identify first." ) );
		return true;
	}

	const auto answer = QMessageBox::question( master.mainWindow(), m_feature.displayName(),
											   tr( "Ask the users of %1 computer(s) for their computer number?" )
												   .arg( computerControlInterfaces.count() ) );
	if( answer == QMessageBox::Yes )
	{
		controlFeature( m_feature.uid(), Operation::Start, {}, computerControlInterfaces );
	}

	return true;
}



bool MachineNumberFeaturePlugin::handleFeatureMessage( ComputerControlInterface::Pointer computerControlInterface,
													   const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() ||
		message.command<FeatureCommand>() != FeatureCommand::ReplyNumber )
	{
		return false;
	}

	const auto number = message.argument( Argument::Number ).toInt();
	if( number < 1 )
	{
		return true; // người dùng bỏ qua hộp thoại
	}

	const auto host = computerControlInterface->computer().hostName();
	const auto error = assignNumber( host, number );
	if( error.isEmpty() == false )
	{
		auto box = new QMessageBox( QMessageBox::Warning, m_feature.displayName(),
									tr( "Could not assign number %1 to %2: %3" ).arg( number ).arg( host, error ) );
		box->setAttribute( Qt::WA_DeleteOnClose );
		box->show();
	}

	return true;
}



QString MachineNumberFeaturePlugin::assignNumber( const QString& hostAddress, int number )
{
	BuiltinDirectoryConfiguration configuration( &VeyonCore::config() );
	ObjectManager<NetworkObject> objectManager( configuration.networkObjects() );

	const auto newName = machineName( number );

	const NetworkObject* target = nullptr;
	NetworkObjectList hosts;
	for( const auto& value : objectManager.objects() )
	{
		hosts.append( NetworkObject{ value.toObject() } );
	}

	for( const auto& object : hosts )
	{
		if( object.type() != NetworkObject::Type::Host )
		{
			continue;
		}
		if( object.hostAddress().compare( hostAddress, Qt::CaseInsensitive ) == 0 )
		{
			target = &object;
		}
		else if( object.name().compare( newName, Qt::CaseInsensitive ) == 0 )
		{
			return tr( "the name \"%1\" is already used by %2" ).arg( newName, object.hostAddress() );
		}
	}

	if( target == nullptr )
	{
		return tr( "the computer is not in the built-in directory" );
	}

	const NetworkObject renamed{ NetworkObject::Type::Host, newName, target->hostAddress(),
								 target->macAddress(), target->directoryAddress(),
								 target->uid(), target->parentUid() };

	configuration.setNetworkObjects( objectManager.update( renamed ) );
	VeyonCore::config().flushStore();

	if( auto directory = VeyonCore::networkObjectDirectoryManager().configuredDirectory() )
	{
		directory->update();
	}

	return {};
}



bool MachineNumberFeaturePlugin::handleFeatureMessage( VeyonServerInterface& server,
													   const MessageContext& messageContext,
													   const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() ||
		message.command<FeatureCommand>() != FeatureCommand::AskNumber )
	{
		return false;
	}

	const auto contextId = QUuid::createUuid();
	m_contexts[contextId] = messageContext;

	server.featureWorkerManager().sendMessageToUnmanagedSessionWorker(
		FeatureMessage{ m_feature.uid(), FeatureCommand::AskNumber }
			.addArgument( Argument::ContextId, contextId ) );

	return true;
}



bool MachineNumberFeaturePlugin::handleFeatureMessageFromWorker( VeyonServerInterface& server,
																 const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() || message.hasArgument( Argument::ContextId ) == false )
	{
		return false;
	}

	const auto contextId = message.argument( Argument::ContextId ).toUuid();

	server.featureWorkerManager().stopWorker( m_feature.uid() );

	// nếu contextId không còn, MessageContext mặc định có ioDevice=nullptr nên lệnh gửi sẽ bị bỏ qua
	return server.sendFeatureMessageReply( m_contexts.take( contextId ), message );
}



bool MachineNumberFeaturePlugin::handleFeatureMessage( VeyonWorkerInterface& worker, const FeatureMessage& message )
{
	if( message.featureUid() != m_feature.uid() ||
		message.command<FeatureCommand>() != FeatureCommand::AskNumber )
	{
		return false;
	}

	qApp->setQuitOnLastWindowClosed( false );

	QInputDialog dialog;
	dialog.setWindowTitle( tr( "Which computer are you?" ) );
	dialog.setLabelText( tr( "Please enter the number written on this computer:" ) );
	dialog.setInputMode( QInputDialog::IntInput );
	dialog.setIntRange( 1, 999 );
	dialog.setIntValue( 1 );
	dialog.setWindowFlags( dialog.windowFlags() & ( ~Qt::WindowCloseButtonHint ) );
	dialog.setStyleSheet( QStringLiteral( "button-layout:%1" ).arg( QDialogButtonBox::WinLayout ) );

	VeyonCore::platform().coreFunctions().raiseWindow( &dialog, true );

	const auto accepted = dialog.exec() == QDialog::Accepted;

	return worker.sendFeatureMessageReply( FeatureMessage{ m_feature.uid(), FeatureCommand::ReplyNumber }
											   .addArgument( Argument::ContextId, message.argument( Argument::ContextId ) )
											   .addArgument( Argument::Number, accepted ? dialog.intValue() : 0 ) );
}
