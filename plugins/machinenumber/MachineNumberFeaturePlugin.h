/*
 * MachineNumberFeaturePlugin.h - tự nhận diện số máy: học sinh nhập số máy của mình,
 * giáo viên tự gán tên "Máy NN" cho đúng máy trong danh bạ tích hợp.
 *
 * Phát hành theo GPL v2 (như Veyon).
 */

#pragma once

#include <QHash>

#include "Feature.h"
#include "FeatureProviderInterface.h"

class MachineNumberFeaturePlugin : public QObject, FeatureProviderInterface, PluginInterface
{
	Q_OBJECT
	Q_PLUGIN_METADATA(IID "io.veyon.Veyon.Plugins.MachineNumber")
	Q_INTERFACES(PluginInterface FeatureProviderInterface)
public:
	enum class Argument {
		ContextId,
		Number
	};
	Q_ENUM(Argument)

	explicit MachineNumberFeaturePlugin( QObject* parent = nullptr );
	~MachineNumberFeaturePlugin() override = default;

	Plugin::Uid uid() const override
	{
		return Plugin::Uid{ QStringLiteral("63ac4470-934c-4d4b-b196-70b02bf057a2") };
	}

	QVersionNumber version() const override
	{
		return QVersionNumber( 1, 0 );
	}

	QString name() const override
	{
		return QStringLiteral("MachineNumber");
	}

	QString description() const override
	{
		return tr( "Identify the number of each computer by asking its user" );
	}

	QString vendor() const override
	{
		return QStringLiteral("QLPhongMay");
	}

	QString copyright() const override
	{
		return QStringLiteral("QLPhongMay");
	}

	const FeatureList& featureList() const override;

	bool controlFeature( Feature::Uid featureUid, Operation operation, const QVariantMap& arguments,
						 const ComputerControlInterfaceList& computerControlInterfaces ) override;

	bool startFeature( VeyonMasterInterface& master, const Feature& feature,
					   const ComputerControlInterfaceList& computerControlInterfaces ) override;

	// master: nhận số máy do học sinh nhập
	bool handleFeatureMessage( ComputerControlInterface::Pointer computerControlInterface,
							   const FeatureMessage& message ) override;

	// server: chuyển yêu cầu xuống worker (phiên người dùng) và nhớ nơi cần trả lời
	bool handleFeatureMessage( VeyonServerInterface& server,
							   const MessageContext& messageContext,
							   const FeatureMessage& message ) override;

	// server: chuyển câu trả lời của worker về master
	bool handleFeatureMessageFromWorker( VeyonServerInterface& server, const FeatureMessage& message ) override;

	// worker: hiện hộp thoại hỏi số máy
	bool handleFeatureMessage( VeyonWorkerInterface& worker, const FeatureMessage& message ) override;

	/*!
	 * \brief Đổi tên máy có địa chỉ \a hostAddress thành "Máy NN" trong danh bạ tích hợp
	 * \return chuỗi rỗng nếu thành công, ngược lại là mô tả lỗi
	 */
	static QString assignNumber( const QString& hostAddress, int number );

	static QString machineName( int number );

private:
	enum class FeatureCommand {
		AskNumber,
		ReplyNumber
	};

	const Feature m_feature;
	const FeatureList m_features;

	QHash<QUuid, MessageContext> m_contexts;
};
